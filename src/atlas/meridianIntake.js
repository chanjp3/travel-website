/**
 * Meridian intake — the cinematic map-first trip builder, adapted from the
 * design reference into a mountable module. d3-driven and imperative by
 * design (proven code); React wraps it via <MeridianIntake/>. The flow:
 * origin country → city → airport → destination country → nights → stops
 * (one pin per night) → end city → fly-home airport → plotted summary.
 * Completion hands a plain trip object to onComplete — the app's engines
 * (optimizer, live fares, award space, funding) take over from there.
 */
import * as d3 from "d3";
import * as topojson from "topojson-client";
import { WORLD } from "../data/atlas/worldTopo.js";
import { AIRPORTS_RAW, NUM2A2 } from "../data/atlas/airports.js";
import { geoSearch, liveHotelsDetailed, liveMode, limitNotes, searchPOI, liveFlights, liveAwards, livePlaces } from "../api/client.js";
import { mergeLiveLeg, mergeLiveAwards } from "../lib/liveMerge.js";
import { applyFlightView, layoversOf, stopsOf, SORTS, STOP_CAPS } from "../lib/flightFilters.js";
import { partyFare } from "../lib/party.js";
import { flightPathHTML, chainPathHTML } from "../lib/flightPath.js";
import { seatsSearchLink } from "../lib/bookLinks.js";
import { bestPath, describePath } from "../lib/funding.js";
import { SOURCES, DEFAULT_BALANCES } from "../data/transferPartners.js";
import { showDetailMap, hideDetailMap, destroyDetailMap, flyDetail } from "./detailMap.js";
import { districtsNear, inDistrict } from "../data/districts.js";
import { mountIntroGlobe } from "./introGlobe.js";
import { HOTEL_GROUPS, brandGroupOf } from "../lib/hotelBrands.js";
import { searchCities } from "../data/world.js";
import { attractionsFor } from "../lib/trip.js";
import { railEdge } from "../data/corridors/index.js";
import { hopOptions, chosenOption, fmtMin } from "../lib/groundModes.js";
import "./meridian.css";

const SCAFFOLD = `
<div id="map"></div>
<div id="banner" aria-hidden="true">
  <div id="kicker"></div>
  <div id="bannerQ"></div>
</div>
<div id="intro">
  <canvas id="introGlobe" aria-hidden="true"></canvas>
  <div class="inner">
    <div class="kick">Private trip atelier</div>
    <h1><span class="word">Meridian</span><span>Chart your journey across the atlas</span></h1>
    <div class="rule"></div>
    <button class="btn red" id="beginBtn">Begin plotting &nbsp;→</button>
    <div class="legal"><a href="/terms.html">Terms</a> · <a href="/privacy.html">Privacy</a></div>
  </div>
</div>
<div id="qcard"></div>
<div id="ticket">
  <div class="rail-head">
    <div class="mark"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.5 15.5l-8-4.7V4.2c0-.9-.7-1.7-1.5-1.7s-1.5.8-1.5 1.7v6.6l-8 4.7v2l8-2.5v5.4l-2 1.6v1.5l3.5-1 3.5 1V22l-2-1.6V15l8 2.5v-2z"/></svg></div>
    <div>
      <div class="brand">Meridian <em>Atelier</em></div>
      <div class="brand-sub">Points-first itineraries</div>
    </div>
  </div>
  <div id="railBody">
    <div class="tseg" data-step="from"><div class="tl">From</div><div class="tv" id="t-from">———</div></div>
    <div class="tseg" data-step="date"><div class="tl">Departs</div><div class="tv" id="t-date">———</div></div>
    <div class="tseg" data-step="to"><div class="tl">To</div><div class="tv" id="t-to">———</div></div>
    <div class="tseg" data-step="flight"><div class="tl">Flight</div><div class="tv" id="t-flight">———</div></div>
    <div class="tseg" data-step="nights"><div class="tl">Nights</div><div class="tv" id="t-nights">—</div></div>
    <div class="tseg" data-step="stops"><div class="tl">Stops</div><div class="tv" id="t-stops">—</div></div>
    <div class="tseg" data-step="return"><div class="tl">Returns</div><div class="tv" id="t-return">———</div></div>
  </div>
  <div class="rail-foot">
    <span id="footStatus">Awaiting departure</span>
    <button id="railRestart">Start over</button>
  </div>
</div>
<div id="toast"></div>
`;

export function mountMeridian(container, { onComplete, initialDate, getBalances, skipIntro = false } = {}) {
const getBal = () => getBalances?.() ?? DEFAULT_BALANCES;
  container.innerHTML = SCAFFOLD;
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const DUR = RM ? 0 : 1400;

// ---- data prep -------------------------------------------------
const airports = AIRPORTS_RAW.map(a => ({iata:a[0], name:a[1], lat:a[2], lon:a[3], cc:a[4], city:a[5]||a[1], large:a[6]===1, region:a[7]||''}));
const byCC = d3.group(airports, d=>d.cc);

function citiesOf(cc){
  const list = byCC.get(cc)||[];
  const m = d3.group(list, d=>d.city+'|'+d.region);
  // Merge same-named groups whose centroids sit within metro range: HND
  // (Tokyo pref.) and NRT (Chiba) are one Tokyo; Portland OR/ME stay two.
  const byName = d3.group([...m.values()], g=>g[0].city);
  const merged = [];
  for(const [, gs] of byName){
    const pool=[...gs];
    while(pool.length){
      const clump=[...pool.shift()];
      for(let i=pool.length-1;i>=0;i--){
        const g=pool[i];
        const d=haversine(
          {lat:d3.mean(clump,x=>x.lat),lon:d3.mean(clump,x=>x.lon)},
          {lat:d3.mean(g,x=>x.lat),lon:d3.mean(g,x=>x.lon)});
        if(d<150){ clump.push(...g); pool.splice(i,1); }
      }
      merged.push(clump);
    }
  }
  const out = [];
  for(const aps of merged){
    const city = aps[0].city;
    if(!city) continue;
    out.push({city, cc, region:aps[0].region, lat:d3.mean(aps,d=>d.lat), lon:d3.mean(aps,d=>d.lon),
      large:aps.some(d=>d.large), n:aps.length, airports:aps.slice().sort((a,b)=>(b.large-a.large)||((HUBRANK.get(a.iata)??999)-(HUBRANK.get(b.iata)??999)))});
  }
  // if a city name appears in multiple regions, append region for clarity
  const nameCount = d3.rollup(out,v=>v.length,d=>d.city);
  out.forEach(c=>{ if(nameCount.get(c.city)>1 && c.region) c.city = `${c.city} (${c.region})`; });
  out.forEach(c=>{ c.hub=d3.min(c.airports,a=>HUBRANK.has(a.iata)?HUBRANK.get(a.iata):999); });
  out.sort((a,b)=>(a.hub-b.hub)||(b.large-a.large)||(b.n-a.n)||a.city.localeCompare(b.city));
  return out;
}

const HUBS=['ATL','LHR','CDG','AMS','FRA','IST','DXB','JFK','LAX','ORD','DFW','DEN','SFO','MIA','SEA','EWR','HND','NRT','ICN','PEK','PVG','HKG','SIN','BKK','KUL','DEL','BOM','SYD','MEL','AKL','YYZ','YVR','MEX','GRU','EZE','SCL','BOG','LIM','GIG','MAD','BCN','FCO','MXP','VCE','NAP','MUC','BER','ZRH','VIE','GVA','CPH','OSL','ARN','HEL','DUB','EDI','MAN','LIS','OPO','ATH','PRG','BUD','WAW','KRK','DME','LED','CAI','CMN','JNB','CPT','NBO','ADD','LOS','TLV','DOH','AUH','JED','RUH','TPE','MNL','CGK','DPS','SGN','HAN','PNH','RGN','KIX','CTS','FUK','OKA','TPA','MCO','BOS','IAD','PHL','CLT','IAH','PHX','LAS','SAN','PDX','MSP','DTW','STL','BNA','AUS','MSY','HNL','ANC','YUL','YYC','CUN','PTY','SJO','HAV','SJU','NAS','MBJ','BGI','FLR','PSA','CTA','PMO','NCE','LYS','MRS','TLS','BOD','AGP','SVQ','VLC','PMI','IBZ','GLA','BHX','BRS','LPL','KEF','FAO','GOT','BLL','KRK','GDN','OTP','SOF','BEG','ZAG','SPU','DBV','TIA','SKG','HER','RHO','JTR','JMK','LCA','MLA'];
const HUBRANK=new Map(HUBS.map((c,i)=>[c,i]));
const countries = topojson.feature(WORLD, WORLD.objects.countries).features
  .filter(f=>f.properties.name!=='Antarctica');
const nameOf = f=>f.properties.name;
const a2Of = f=>NUM2A2[String(+f.id)]||null;
const byA2 = new Map(countries.map(f=>[a2Of(f),f]));
const ALIASES = {'usa':'United States of America','united states':'United States of America','uk':'United Kingdom','england':'United Kingdom','holland':'Netherlands','uae':'United Arab Emirates','south korea':'South Korea','czechia':'Czechia','ivory coast':"Côte d'Ivoire",'burma':'Myanmar'};

// ---- map scaffolding ------------------------------------------
const W = container.clientWidth || innerWidth, H = container.clientHeight || innerHeight;
const svg = d3.select(container.querySelector('#map')).append('svg').attr('width',W).attr('height',H).attr('viewBox',`0 0 ${W} ${H}`);
const defs = svg.append('defs');
const og = defs.append('radialGradient').attr('id','oceanGrad').attr('cx','50%').attr('cy','42%').attr('r','75%');
og.append('stop').attr('offset','0%').attr('stop-color','var(--ocean)');
og.append('stop').attr('offset','100%').attr('stop-color','var(--ocean-deep)');

const proj = d3.geoNaturalEarth1().fitSize([W,H*1.06],{type:'Sphere'});
proj.translate([W/2, H/2+H*0.02]);
const path = d3.geoPath(proj);
const root = svg.append('g');
root.append('path').attr('class','sphere').attr('d',path({type:'Sphere'}));
root.append('path').attr('class','graticule').attr('d',path(d3.geoGraticule10()));
const gCountries = root.append('g');
const gArcs = svg.append('g');
const gMarkers = svg.append('g');

const cSel = gCountries.selectAll('path').data(countries).join('path')
  .attr('class','country').attr('d',path)
  .on('click',(e,f)=>onCountryClick(f));

const zoom = d3.zoom().scaleExtent([1,90]).on('zoom',e=>{
  root.attr('transform',e.transform);
  curT = e.transform;
  gCountries.selectAll('path').attr('stroke-width', .7/curT.k); // constant hairline at any zoom
  root.select('.graticule').attr('stroke-width', .5/curT.k);
  place();
});
svg.call(zoom).on('dblclick.zoom',null);
let curT = d3.zoomIdentity;
function place(){
  const t=curT;
  gMarkers.selectAll('g.pos').attr('transform',function(){
    const p=t.apply(d3.select(this).datum()._p); return `translate(${p[0]},${p[1]})`;});
  gMarkers.selectAll('g.city-dot').each(function(){
    const d=d3.select(this).datum();
    d3.select(this).select('text').style('display',(d.large||d._rank<14||t.k>7)?null:'none');
  });
  gArcs.selectAll('path.routearc').attr('d',function(){ return arcPath(d3.select(this).datum().pts); });
}
/** Screen path for an arc, broken where it crosses the date line (the
 *  projection wraps there — one unbroken line would cross the whole map). */
function arcPath(pts){
  let d='';
  pts.forEach((p,i)=>{
    const q=curT.apply(p), jump=i>0&&Math.abs(p[0]-pts[i-1][0])>W*0.4;
    d+=(i===0||jump?'M':'L')+q[0].toFixed(1)+','+q[1].toFixed(1);
  });
  return d;
}
function zoomToBounds(b, pad=0.28, dur=DUR, insetRight=0){
  const [[x0,y0],[x1,y1]] = b;
  const Wa = W - insetRight;
  const k = Math.max(1, Math.min(88, .92/Math.max((x1-x0)/Wa/(1-pad),(y1-y0)/H/(1-pad))));
  const t = d3.zoomIdentity.translate(Wa/2-k*(x0+x1)/2, H/2-k*(y0+y1)/2).scale(k);
  return svg.transition().duration(dur).ease(d3.easeCubicInOut).call(zoom.transform,t).end().catch(()=>{});
}
function featureBounds(f){
  const b = path.bounds(f);
  if((b[1][0]-b[0][0]) < W*0.55) return b;
  // country spans the antimeridian (US, Russia, Fiji…) — use its largest polygon instead
  let best=null, bestA=-1;
  const polys = f.geometry.type==='MultiPolygon' ? f.geometry.coordinates.map(c=>({type:'Polygon',coordinates:c})) : [f.geometry];
  for(const p of polys){
    const a = path.area(p);
    if(a>bestA){ bestA=a; best=p; }
  }
  return path.bounds(best);
}
const zoomToFeature = (f,pad,dur)=>zoomToBounds(featureBounds(f),pad,dur);
const zoomOut = (dur=DUR)=>svg.transition().duration(dur).ease(d3.easeCubicInOut)
  .call(zoom.transform,d3.zoomIdentity).end().catch(()=>{});
function zoomToPoint(lonlat, k=26, dur=DUR){
  const [x,y]=proj(lonlat);
  const t=d3.zoomIdentity.translate(W/2-k*x,H/2-k*y).scale(k);
  return svg.transition().duration(dur).ease(d3.easeCubicInOut).call(zoom.transform,t).end().catch(()=>{});
}

// ---- helpers ---------------------------------------------------
const $ = s=>container.querySelector(s);
const qcard = $('#qcard');
const fmtDate = d=>{ if(!d) return '———'; const [y,m,dd]=d.split('-'); return `${dd} ${['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][+m-1]} ${y.slice(2)}`; };
function toast(msg){ const t=$('#toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(t._h); t._h=setTimeout(()=>t.classList.remove('show'),2600); }
function haversine(a,b){
  const R=6371,rad=x=>x*Math.PI/180;
  const dLat=rad(b.lat-a.lat),dLon=rad(b.lon-a.lon);
  const h=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
}
function showCard(html){
  qcard.innerHTML='<button class="qmin" id="qmin" aria-label="Minimize card" title="Minimize — use the map">—</button>'+html;
  qcard.classList.remove('show','min');
  requestAnimationFrame(()=>requestAnimationFrame(()=>qcard.classList.add('show')));
  // mirror the step's question into the cinematic top banner
  const bq=container.querySelector('#bannerQ'), bk=container.querySelector('#kicker');
  if(bq){
    const q=qcard.querySelector('.question'), e=qcard.querySelector('.eyebrow');
    bq.textContent=q?q.textContent:''; if(bk) bk.textContent=e?e.textContent:'';
  }
  const mb=$('#qmin');
  mb.onclick=(e)=>{ e.stopPropagation(); qcard.classList.toggle('min'); mb.textContent=qcard.classList.contains('min')?'+':'—'; };
  qcard.onclick=()=>{ if(qcard.classList.contains('min')){ qcard.classList.remove('min'); mb.textContent='—'; } };
}
function hideCard(){ qcard.classList.remove('show','typing'); }
// Phones: give the sheet the screen while a field with suggestions is in use.
qcard.addEventListener('focusin',e=>{ if(innerWidth<=640&&e.target.matches('input[type=text]')) qcard.classList.add('typing'); });
qcard.addEventListener('focusout',()=>setTimeout(()=>{ if(!qcard.contains(document.activeElement)) qcard.classList.remove('typing'); },200));
const FOOT_LABELS={from:'Choosing origin',date:'Setting departure',to:'Choosing destination',flight:'Choosing your flight',nights:'Allocating nights',stops:'Plotting the route',return:'Return & home'};
function ticket(seg,val,active){
  const el = $('#t-'+seg);
  if(val!==undefined && val!==null){ el.innerHTML=val; el.closest('.tseg').classList.add('done'); }
  container.querySelectorAll('.tseg').forEach(s=>s.classList.remove('active'));
  if(active) document.querySelector(`.tseg[data-step="${active}"]`)?.classList.add('active');
  const fs=$('#footStatus'); if(fs) fs.textContent=active?FOOT_LABELS[active]??'En route':'Journey plotted';
}

// typeahead — `rank(item, q)` (lower = better) overrides the default
// earliest-match ordering when a list mixes kinds (cities, airports…).
function attachTypeahead(input, listEl, items, render, onPick, rank=null, limit=40){
  let hi=-1, view=[];
  const draw=()=>{ listEl.innerHTML=view.slice(0,limit).map((it,i)=>`<div data-i="${i}" class="${i===hi?'hi':''}">${render(it)}</div>`).join('');
    listEl.classList.toggle('open',view.length>0);
    listEl.querySelectorAll('div[data-i]').forEach(d=>d.onclick=()=>{onPick(view[+d.dataset.i]); listEl.classList.remove('open');}); };
  input.addEventListener('input',()=>{
    const q=input.value.trim().toLowerCase(); hi=-1;
    if(!q){view=[];draw();return;}
    view=items.filter(it=>it._s.includes(q));
    view.sort(rank?(a,b)=>rank(a,q)-rank(b,q):(a,b)=>a._s.indexOf(q)-b._s.indexOf(q));
    draw();
  });
  input.addEventListener('keydown',e=>{
    if(e.key==='ArrowDown'){hi=Math.min(hi+1,Math.min(view.length,limit)-1);draw();e.preventDefault();}
    else if(e.key==='ArrowUp'){hi=Math.max(hi-1,0);draw();e.preventDefault();}
    else if(e.key==='Enter'&&view.length){onPick(view[hi<0?0:hi]);listEl.classList.remove('open');e.preventDefault();}
    else if(e.key==='Escape'){listEl.classList.remove('open');}
  });
}
const countryItems = countries.map(f=>({f,_s:nameOf(f).toLowerCase()}));
Object.entries(ALIASES).forEach(([alias,nm])=>{
  const f=countries.find(c=>nameOf(c)===nm); if(f) countryItems.push({f,alias,_s:alias});
});

// Worldwide place search: every scheduled-airport city (metro areas group
// their airports — Tokyo = HND + NRT), every airport by code or name, and
// countries for browsing on the map. Built once; filtered per keystroke.
const countryByCC = new Map(countries.map(f=>[a2Of(f),f]));
const ccName = cc=>{ const f=countryByCC.get(cc); return f?nameOf(f):cc; };
const allCities = [...byCC.keys()].flatMap(cc=>citiesOf(cc));
const placeItems = [
  ...allCities.map(c=>({kind:'city',c,cc:c.cc,_s:`${c.city} ${ccName(c.cc)} ${c.airports.map(a=>a.iata).join(' ')}`.toLowerCase()})),
  ...allCities.flatMap(c=>c.airports.map(a=>({kind:'ap',a,c,cc:c.cc,_s:`${a.iata} ${a.city} ${a.name} ${ccName(c.cc)}`.toLowerCase()}))),
  ...countryItems.map(it=>({kind:'country',f:it.f,alias:it.alias,_s:it._s})),
];
const placeRank=(it,q)=>{
  let s=it._s.indexOf(q)*10;
  if(it.kind==='ap'){ if(it.a.iata.toLowerCase()===q) s-=2000; if(it.a.city.toLowerCase().startsWith(q)) s-=150; s+=it.a.large?0:60; s+=Math.min(HUBRANK.get(it.a.iata)??400,400)/8; }
  if(it.kind==='city'){ if(it.c.city.toLowerCase().startsWith(q)) s-=400; s+=it.c.large?0:60; s+=Math.min(it.c.hub,400)/8; if(it.c.airports.length<2) s+=25; }
  if(it.kind==='country'){ if(it._s.startsWith(q)) s-=300; s+=40; }
  return s;
};
const placeHTML=(it)=>it.kind==='country'
  ? `<span>${nameOf(it.f)}</span><span class="code">BROWSE MAP</span>`
  : it.kind==='city'
  ? `<span>${it.c.city}, ${ccName(it.cc)}</span><span class="code">${it.c.airports.slice(0,3).map(a=>a.iata).join(' · ')}${it.c.airports.length>3?' …':''}</span>`
  : `<span>${it.a.city} — ${shortName(it.a)}</span><span class="code">${it.a.iata}</span>`;

// ---- markers ---------------------------------------------------
function drawCityDots(cities, onPick, limit=60){
  gMarkers.selectAll('g.city-dot').remove();
  const shown = cities.slice(0,limit);
  shown.forEach((d,i)=>d._rank=i);
  shown.forEach(d=>d._p=proj([d.lon,d.lat]));
  const g = gMarkers.selectAll('g.city-dot').data(shown,d=>d.city).join('g')
    .attr('class',d=>'pos city-dot'+(d.large?'':' med'))
    .style('opacity',0)
    .on('click',(e,d)=>{e.stopPropagation();onPick(d);});
  g.append('circle').attr('r',d=>d.large?5.5:4);
  g.append('text').text(d=>d.city).attr('x',9).attr('y',4.2);
  g.transition().delay((d,i)=>RM?0:i*18).duration(RM?0:350).style('opacity',1);
  place();
}
function clearDots(){ gMarkers.selectAll('g.city-dot').remove(); }
function drawStopBadges(stops){
  gMarkers.selectAll('g.stopbadge').remove();
  let night=1;
  const data = stops.map(s=>{ const from=night, to=night+s.nights-1; night+=s.nights;
    return {...s,label:s.nights>1?`${from}–${to}`:`${from}`}; });
  data.forEach(d=>d._p=proj([d.lon,d.lat]));
  const g = gMarkers.selectAll('g.stopbadge').data(data).join('g').attr('class','pos stopbadge');
  g.append('circle').attr('r',11);
  g.append('text').attr('class','num').text(d=>d.label).attr('y',3.7);
  g.append('text').attr('class','lbl').text(d=>d.city).attr('x',16).attr('y',4.2);
  place();
}
function drawHomeBadge(pt,label){
  const g=gMarkers.append('g').attr('class','pos homebadge').datum({_p:proj([pt.lon,pt.lat])});
  g.append('circle').attr('r',11); g.append('text').text(label).attr('y',3.2);
  place();
}

// great-circle arcs, drawn in screen space
function arcPts(a,b){
  const ip=d3.geoInterpolate([a.lon,a.lat],[b.lon,b.lat]);
  return d3.range(0,1.0001,1/48).map(t=>proj(ip(t)));
}
function drawArcs(legs, animate=true, ghost=false){
  gArcs.selectAll('*').remove();
  legs.forEach((leg,i)=>{
    const p=gArcs.append('path')
      .datum({pts:arcPts(leg.a,leg.b)})
      .attr('class','routearc'+(leg.mode&&leg.mode!=='flight'?' ground':'')+(ghost?' ghost':''));
    p.attr('d',arcPath(p.datum().pts));
    if(animate&&!RM&&!ghost&&(!leg.mode||leg.mode==='flight')){
      const L=p.node().getTotalLength();
      p.attr('stroke-dasharray',L).attr('stroke-dashoffset',L)
       .transition().delay(300+i*450).duration(800).ease(d3.easeCubicOut)
       .attr('stroke-dashoffset',0)
       .on('end',function(){ d3.select(this).attr('stroke-dasharray',null); });
    }
  });
}

// ---- trip state ------------------------------------------------
const freshTrip = () => ({
  date:null,
  type:'round',       // round | oneway (return picks both ends) | noreturn
  pax:{adults:1,children:0,infants:0},
  origin:{country:null,city:null,airport:null},
  dest:{country:null,gwCity:null,airport:null},
  nights:0,
  stops:[],           // {city,lat,lon,nights,airports,cc}
  endCity:null, endAirport:null, hotelPicks:{},
  cabin:'Business', outFlight:null, backFlight:null,
  home:null,          // airport flying back to
  hopModes:{},        // between-cities choice per hop key
  flightView:{sort:'best',stops:'any',hideSep:false,minLay:180,overnight:true,avoid:'',via:''},
});
const trip = freshTrip();
const seatsOf = ()=>trip.pax.adults+trip.pax.children;           // paying seats
const peopleOf = ()=>trip.pax.adults+trip.pax.children+trip.pax.infants;
const paxLabel = ()=>{ const n=peopleOf(); return n===1?'1 traveler':`${n} travelers`; };
/** First night of the trip: the real arrival date when the chosen flight
 *  carries one; otherwise long-hauls (>6,000 km) land the next day. */
function arriveISO(){
  const segs=trip.outFlight?.segs;
  const last=segs?.[segs.length-1]?.arr;
  if(last && /^\d{4}-\d{2}-\d{2}/.test(last)) return String(last).slice(0,10);
  const o=trip.origin.airport, d=trip.dest.airport;
  return addDaysISO(trip.date, o&&d&&haversine(o,d)>6000?1:0);
}
const totalNights = ()=>d3.sum(trip.stops,s=>s.nights);
const returnISO = ()=>addDaysISO(arriveISO(), Math.max(totalNights(),1));

// ============================================================
// STEP FLOW
// ============================================================
let clickHandler = null;
function onCountryClick(f){ if(clickHandler) clickHandler(f); }
function setCountryMode(on){ cSel.classed('hoverable',on); }

function markCountry(f){
  cSel.classed('selected',d=>d===f);
}

/** Full restart — from the rail's Start over button or the summary card. */
function resetTrip(){
  hideCard(); hideDetailMap(); tourSeq++; flSeq++;
  gMarkers.selectAll('.hotelpin,.homebadge,.stopbadge').remove(); gArcs.selectAll('*').remove();
  const keepCabin=trip.cabin;
  Object.assign(trip,freshTrip(),{cabin:keepCabin});
  container.querySelectorAll('.tseg').forEach(s=>s.classList.remove('done'));
  ['from','date','to','flight','nights','stops','return'].forEach(k=>{ const el=$('#t-'+k); if(el) el.textContent='———'; });
  stepSetup();
}
container.querySelector('#railRestart')?.addEventListener('click',resetTrip);

/* ---- 1. trip setup: from, to, trip type, date, travelers ---- */
const TYPE_HINT={
  round:'Round trip — the flight home leaves from where you land.',
  oneway:'One-way tickets — the way home can start and end anywhere.',
  noreturn:'No return — a true one-way; you are not flying back on this trip.',
};
const PAX_LIMIT={adults:[1,9],children:[0,8],infants:[0,9]};
function placeLabel(side){
  const p=side==='from'?trip.origin:trip.dest, c=side==='from'?p.city:p.gwCity;
  return p.airport?`${c?.city??p.airport.city} (${p.airport.iata})`:'';
}
function setPlace(side,it){
  if(it.kind==='country'){ hideCard(); return browseCountry(it.f,side); }
  const c=it.c, a=it.kind==='ap'?it.a:c.airports[0];
  const f=countryByCC.get(it.cc)??null;
  if(side==='from'){ trip.origin={country:f,city:c,airport:a}; ticket('from',`${c.city} <span class="iata">${a.iata}</span>`); }
  else { trip.dest={country:f,gwCity:c,airport:a}; ticket('to',`${c.city} <span class="iata">${a.iata}</span>`); }
  frameSetup();
  stepSetup(side==='from'&&!trip.dest.airport?'to':null);
}
/** Map framing while setting up: endpoint badges, and the arc once both
 *  ends are known. */
function frameSetup(){
  gArcs.selectAll('*').remove(); gMarkers.selectAll('.homebadge').remove(); clearDots();
  const o=trip.origin.airport, d=trip.dest.airport;
  cSel.classed('selected',f=>f===trip.origin.country||f===trip.dest.country);
  if(o) drawHomeBadge(o,o.iata);
  if(d) drawHomeBadge(d,d.iata);
  if(o&&d){
    const pts=arcPts(o,d), xs=pts.map(p=>p[0]), ys=pts.map(p=>p[1]);
    zoomToBounds([[d3.min(xs),d3.min(ys)],[d3.max(xs),d3.max(ys)]],0.3,DUR,Math.min(400,W*0.32))
      .then(()=>drawArcs([{a:o,b:d}],true));
  } else if(o||d){ const x=o||d; zoomToPoint([x.lon,x.lat],4); }
}
function stepSetup(focus){
  setCountryMode(true);
  ticket(null,null,!trip.origin.airport?'from':!trip.dest.airport?'to':'date');
  // a country clicked on the map opens its cities for whichever end is still open
  clickHandler=f=>{ hideCard(); browseCountry(f,!trip.origin.airport?'from':'to'); };
  const today=new Date(); const minDate=today.toISOString().slice(0,10);
  today.setDate(today.getDate()+14);
  trip.date=trip.date||initialDate||today.toISOString().slice(0,10);
  const chips=side=>{
    const p=side==='from'?trip.origin:trip.dest, c=side==='from'?p.city:p.gwCity;
    if(!c||c.airports.length<2) return '';
    return `<div class="apchips" data-side="${side}">${c.airports.slice(0,5).map(a=>`
      <button type="button" class="apchip${p.airport?.iata===a.iata?' on':''}" data-ap="${a.iata}" title="${a.name}">${a.iata}<span>${shortName(a)}</span></button>`).join('')}</div>`;
  };
  const ready=trip.origin.airport&&trip.dest.airport&&trip.date;
  showCard(`
    <div class="eyebrow">Step 1 — Trip setup</div>
    <div class="question">Where is this trip?</div>
    <div class="field"><label>From — city or airport</label>
      <input type="text" id="inFrom" placeholder="e.g. Tampa or TPA" autocomplete="off" value="${placeLabel('from')}">
      <div class="suggest" id="sgFrom"></div>
    </div>
    ${chips('from')}
    <div class="field"><label>To — city or airport</label>
      <input type="text" id="inTo" placeholder="e.g. Tokyo or HND" autocomplete="off" value="${placeLabel('to')}">
      <div class="suggest" id="sgTo"></div>
    </div>
    ${chips('to')}
    <div class="field"><label>Trip type</label>
      <div class="seg" id="segType">${[['round','Round trip'],['oneway','One-way'],['noreturn','No return']].map(([k,l])=>`
        <button type="button" data-t="${k}" class="${trip.type===k?'on':''}">${l}</button>`).join('')}</div>
      <div class="hint sm" id="typeHint">${TYPE_HINT[trip.type]}</div>
    </div>
    <div class="field"><label>Departure date</label>
      <input type="date" id="inDate" value="${trip.date}" min="${minDate}">
    </div>
    <div class="field"><label>Travelers</label>
      <div class="paxrow">${[['adults','Adults','12+'],['children','Children','2–11'],['infants','Infants','on lap']].map(([k,l,s])=>`
        <div class="pax"><span class="pl">${l}<em>${s}</em></span>
          <span class="stp"><button type="button" data-p="${k}" data-d="-1" aria-label="Fewer ${l.toLowerCase()}">−</button><span class="n" id="pax-${k}">${trip.pax[k]}</span><button type="button" data-p="${k}" data-d="1" aria-label="More ${l.toLowerCase()}">+</button></span></div>`).join('')}</div>
    </div>
    <div class="row" style="margin-top:6px">
      <button class="btn red" id="go" ${ready?'':'disabled'}>Find flights →</button>
    </div>
    <div class="finenote">Or click any country on the map to browse its cities and airports.</div>`);
  const wire=(side,inp,sg)=>{
    attachTypeahead($(inp),$(sg),placeItems,placeHTML,it=>setPlace(side,it),placeRank,30);
    $(inp).addEventListener('focus',e=>e.target.select());
  };
  wire('from','#inFrom','#sgFrom'); wire('to','#inTo','#sgTo');
  qcard.querySelectorAll('.apchips').forEach(box=>box.querySelectorAll('.apchip').forEach(b=>b.onclick=()=>{
    const side=box.dataset.side, p=side==='from'?trip.origin:trip.dest, c=side==='from'?p.city:p.gwCity;
    const a=c.airports.find(x=>x.iata===b.dataset.ap); if(!a) return;
    p.airport=a; ticket(side,`${c.city} <span class="iata">${a.iata}</span>`);
    frameSetup(); stepSetup();
  }));
  qcard.querySelectorAll('#segType button').forEach(b=>b.onclick=()=>{
    trip.type=b.dataset.t;
    qcard.querySelectorAll('#segType button').forEach(x=>x.classList.toggle('on',x===b));
    $('#typeHint').textContent=TYPE_HINT[trip.type];
  });
  qcard.querySelectorAll('.paxrow button').forEach(b=>b.onclick=()=>{
    const k=b.dataset.p, [lo,hi]=PAX_LIMIT[k];
    const next=Math.max(lo,Math.min(hi,trip.pax[k]+ +b.dataset.d));
    const trial={...trip.pax,[k]:next};
    if(trial.adults+trial.children+trial.infants>9) return toast('Up to 9 travelers per booking');
    if(trial.infants>trial.adults) return toast('Each lap infant needs an adult');
    trip.pax=trial; $('#pax-'+k).textContent=next;
  });
  $('#inDate').onchange=e=>{ trip.date=e.target.value||trip.date; };
  $('#go').onclick=()=>{
    trip.date=$('#inDate').value||trip.date;
    if(!trip.origin.airport||!trip.dest.airport) return;
    if(trip.origin.airport.iata===trip.dest.airport.iata) return toast('From and To are the same airport');
    ticket('date',`${fmtDate(trip.date)} <span class="iata">${peopleOf()}P</span>`);
    setCountryMode(false); clickHandler=null; hideCard();
    stepOutboundFlight();
  };
  const f=focus==='to'?'#inTo':!trip.origin.airport?'#inFrom':null;
  if(f) setTimeout(()=>$(f)?.focus(),450);
}

/* ---- 1b. browse on the map: country → city → airport, then back to setup ---- */
function browseCountry(f,side){
  setCountryMode(false); markCountry(f);
  zoomToFeature(f).then(()=>stepBrowseCity(f,side));
}
function stepBrowseCity(f,side){
  ticket(null,null,side);
  const cc=a2Of(f);
  const cities=citiesOf(cc);
  if(!cities.length){ toast('No scheduled airports found there — pick another country'); return stepSetup(); }
  const items=cities.map(c=>({c,_s:c.city.toLowerCase()}));
  showCard(`
    <div class="eyebrow">Step 1 — ${side==='from'?'From':'To'} · ${nameOf(f)}</div>
    <div class="question">${side==='from'?'Which city do you fly out of?':'Which city do you land in?'}</div>
    <div class="hint">Tap a dot on the map or search below.</div>
    <div class="field"><label>City</label>
      <input type="text" id="inCity" placeholder="Search cities…" autocomplete="off">
      <div class="suggest" id="sgCity"></div>
    </div>
    <div class="optlist" id="cityList">${cities.slice(0,8).map((c,i)=>`
      <div class="opt" data-i="${i}"><span class="dot${c.large?'':' med'}"></span>
        <span class="nm">${c.city}<div class="sub">${c.n} airport${c.n>1?'s':''}</div></span></div>`).join('')}
    </div>
    <button class="backlink" id="bk">← back to trip setup</button>`);
  function pick(c){ hideCard(); clearDots();
    zoomToPoint([c.lon,c.lat], c.airports.length>1?18:26).then(()=>stepBrowseAirport(f,c,side)); }
  drawCityDots(cities,pick);
  attachTypeahead($('#inCity'),$('#sgCity'),items,it=>`<span>${it.c.city}</span>`,it=>pick(it.c));
  $('#cityList').querySelectorAll('.opt').forEach(o=>o.onclick=()=>pick(cities[+o.dataset.i]));
  $('#bk').onclick=()=>{ clearDots(); frameSetup(); stepSetup(); };
  clickHandler=null;
}
function stepBrowseAirport(f,c,side){
  const pick=a=>{ clearDots(); setPlace(side,{kind:'ap',a,c,cc:c.cc}); };
  if(c.airports.length===1) return pick(c.airports[0]);
  drawCityDots(c.airports.map(a=>({city:a.iata+' · '+shortName(a),lat:a.lat,lon:a.lon,large:a.large,_ap:a})),d=>pick(d._ap),12);
  showCard(`
    <div class="eyebrow">Step 1 — ${side==='from'?'From':'To'} · ${c.city}</div>
    <div class="question">${side==='from'?'Choose your departure airport':'Choose your arrival airport'}</div>
    <div class="optlist">${c.airports.map((a,i)=>`
      <div class="opt" data-i="${i}"><span class="iata">${a.iata}</span>
        <span class="nm">${a.name}<div class="sub">${a.large?'Major international':'Regional'}</div></span></div>`).join('')}
    </div>
    <button class="backlink" id="bk">← change city</button>`);
  qcard.querySelectorAll('.opt').forEach(o=>o.onclick=()=>pick(c.airports[+o.dataset.i]));
  $('#bk').onclick=()=>{ clearDots(); zoomToFeature(f).then(()=>stepBrowseCity(f,side)); };
}
function shortName(a){ return a.name.replace(/ International| Airport| Regional/g,'').trim(); }

/* ---- 2 & 4. flight search — the same controls outbound and home ---- */
const CABINS=['Economy','Premium Economy','Business','First'];
const apByIata=new Map(airports.map(a=>[a.iata,a]));
const MIN_LAYS=[[120,'2h'],[180,'3h'],[240,'4h'],[360,'6h']];
let flSeq=0;
function stepFlight({from,to,date,eyebrow,question,stub,onPick,onBack}){
  const seq=++flSeq;
  const v=trip.flightView;
  ticket(null,null,stub);
  const gfQ=`Flights from ${from.iata} to ${to.iata} on ${date} one way${trip.cabin==='Business'?' business class':trip.cabin==='First'?' first class':trip.cabin==='Premium Economy'?' premium economy':''}${seatsOf()>1?` for ${seatsOf()} passengers`:''}`;
  const gf=`https://www.google.com/travel/flights?q=${encodeURIComponent(gfQ)}`;
  const escH=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const opt=(list,val)=>list.map(([k,l])=>`<option value="${k}"${String(val)===String(k)?' selected':''}>${l}</option>`).join('');
  let leg=null, disp=[];
  const shell=(body)=>{
    if(seq!==flSeq) return;
    const moreOpen=qcard.querySelector('.fmore')?.style.display==='block';
    showCard(`
      <div class="eyebrow">${eyebrow}</div>
      <div class="question">${question}</div>
      <div class="hint">${from.iata} → ${to.iata} · ${fmtDate(date)} · ${paxLabel()} · live fares &amp; award space</div>
      <div class="row" style="flex-wrap:wrap;margin-bottom:8px">${CABINS.map(c=>`
        <button class="btn ghost sm cab${trip.cabin===c?' cab-sel':''}" data-cab="${c}">${c}</button>`).join('')}
      </div>
      <div class="fbar">
        <select id="fvSort" class="tsel" aria-label="Sort flights">${opt(SORTS,v.sort)}</select>
        <select id="fvStops" class="tsel" aria-label="Number of stops">${opt(STOP_CAPS,v.stops)}</select>
        <button type="button" class="fmore-btn" id="fvMore">More filters ${moreOpen?'▴':'▾'}</button>
      </div>
      <div class="fmore" style="display:${moreOpen?'block':'none'}">
        <div class="field"><label>Connect via (preferred layover airport)</label>
          <input type="text" id="fvVia" placeholder="e.g. DFW — blank for any" autocomplete="off" value="${escH(v.via)}">
          <div class="suggest" id="sgVia"></div></div>
        <div class="field"><label>Never connect in</label>
          <input type="text" id="fvAvoid" placeholder="e.g. CDG, LHR" autocomplete="off" value="${escH(v.avoid)}"></div>
        <label class="tchk"><input type="checkbox" id="fvSep"${v.hideSep?' checked':''}> Protected connections only — hide separate tickets</label>
        <label class="tchk"><input type="checkbox" id="fvOvn"${v.overnight?' checked':''}> Overnight layovers are OK</label>
        <div class="tline">Separate-ticket layover at least
          <select id="fvMinLay" class="tsel">${opt(MIN_LAYS,v.minLay)}</select></div>
      </div>
      ${body}
      <div class="row" style="margin-top:10px">
        <button class="btn ghost sm" id="flSkip">Decide later →</button>
        ${onBack?'<button class="btn ghost sm" id="flBk">Back</button>':''}
      </div>
      <div class="finenote">
        <a href="${gf}" target="_blank" rel="noreferrer" style="color:var(--route)">Compare live on Google Flights ↗</a>
        &nbsp;·&nbsp;
        <a href="${seatsSearchLink(from.iata,to.iata,date)}" target="_blank" rel="noreferrer" style="color:var(--route)">Live award search on seats.aero ↗</a>
        &nbsp;·&nbsp;
        <button type="button" class="flre">↻ re-check</button>
      </div>`);
    qcard.querySelectorAll('.cab').forEach(b=>b.onclick=()=>{ trip.cabin=b.dataset.cab; load(); });
    qcard.querySelectorAll('.flre').forEach(b=>b.onclick=()=>load());
    $('#fvSort').onchange=e=>{ v.sort=e.target.value; paint(); };
    $('#fvStops').onchange=e=>{ v.stops=e.target.value; paint(); };
    $('#fvMore').onclick=()=>{ const m=qcard.querySelector('.fmore'); const open=m.style.display!=='block';
      m.style.display=open?'block':'none'; $('#fvMore').textContent=`More filters ${open?'▴':'▾'}`; };
    $('#fvSep').onchange=e=>{ v.hideSep=e.target.checked; paint(); };
    $('#fvOvn').onchange=e=>{ v.overnight=e.target.checked; paint(); };
    $('#fvAvoid').onchange=e=>{ v.avoid=e.target.value.toUpperCase(); paint(); };
    $('#fvMinLay').onchange=e=>{ v.minLay=+e.target.value; load(); };
    const via=$('#fvVia');
    attachTypeahead(via,$('#sgVia'),viaItems,it=>`<span>${it.a.city} — ${shortName(it.a)}</span><span class="code">${it.a.iata}</span>`,
      it=>{ v.via=it.a.iata; load(); },null,12);
    via.onchange=()=>{ if(!via.value.trim()&&v.via){ v.via=''; load(); } };
    $('#flSkip').onclick=()=>onPick(null);
    if(onBack){ const bk=$('#flBk'); if(bk) bk.onclick=onBack; }
  };
  const seats=seatsOf();
  const rowHTML=(f,i,minSingle)=>{
    const total=f.points?null:partyFare(f.cash,trip.pax);
    const price=f.points
      ?`${(f.points*seats/1000).toFixed(0)}K <em>${escH(SOURCES[f.programId]?.short??'')}</em>`
      :`$${Math.round(total).toLocaleString()}`;
    const per=seats>1||trip.pax.infants?`<div class="f-per">${f.points?`${(f.points/1000).toFixed(0)}K`:`$${Math.round(f.cash).toLocaleString()}`} per person</div>`:'';
    const lays=layoversOf(f);
    const hubAp=f.selfTransfer?apByIata.get(f.hub):null;
    const crossBorder=hubAp&&hubAp.cc!==trip.origin.airport?.cc;
    const tags=[
      f.awardLive?'LIVE AWARD':null,
      f.awardLive&&f.seats>0?(f.seats<seats?`only ${f.seats} seat${f.seats!==1?'s':''}`:`${f.seats} seat${f.seats!==1?'s':''}`):null,
      f.twoBookings?'2 bookings':null,
      f.selfTransfer?'separate tickets':null,
      f.testData?'test data':null,
      (!f.points&&!f.testData&&f.live)?(f.gfLive?'Google Flights':f.bookable?'bookable':'live'):null,
      f.roundTrip?'½ round-trip':null,
    ].filter(Boolean).map(t=>`<span class="f-tag">${escH(t)}</span>`).join('');
    const path=flightPathHTML(f)
      ??(f.twoBookings&&f.viaHub?chainPathHTML([from.iata,f.viaHub,to.iata],'2 bookings'):null)
      ??'';
    const st=stopsOf(f);
    const aircraft=[...new Set((f.segs??[]).map(s=>s.aircraft).filter(Boolean))].join(' · ');
    const meta=[f.dep?`${f.dep}${f.arr?'–'+f.arr:''}`:null,st===0?'nonstop':st!=null?`${st} stop${st!==1?'s':''}`:null,(!path&&f.via)?f.via:null,f.dur,
      (!path&&f.flightNos)?f.flightNos:null,aircraft||null]
      .filter(Boolean).join(' · ');
    const layNote=lays.filter(l=>l.min!=null).map(l=>`${Math.floor(l.min/60)}h ${String(l.min%60).padStart(2,'0')}m in ${l.at}${l.overnight?' (overnight)':''}`).join(' · ');
    const sepNote=f.selfTransfer?`<div class="f-warn">Two separate tickets via ${escH(f.hub)}: collect your bags and check in again${crossBorder?`, clearing immigration in ${escH(ccName(hubAp.cc))} — check transit-visa rules`:''}. A delay on ticket 1 does not protect ticket 2.${minSingle&&f.cash<minSingle?` <b>Saves $${Math.round(partyFare(minSingle-f.cash,trip.pax)).toLocaleString()} vs the best single ticket.</b>`:''}</div>`:'';
    const fund=f.points?`<div class="f-fund">${describePath(bestPath(f.programId,f.points*seats,getBal()),f.programId)} · +$${Math.round((f.fees??0)*seats)} taxes</div>`:'';
    return `<div class="fcard" data-i="${i}">
      <div class="f-top"><span class="f-route">${escH(f.airline)}</span><span class="f-price">${price}</span></div>
      ${per}
      ${tags?`<div class="f-tags">${tags}<span class="f-cab">${escH(f.cabin)}</span></div>`:`<div class="f-tags"><span class="f-cab">${escH(f.cabin)}</span></div>`}
      ${meta?`<div class="f-meta">${escH(meta)}</div>`:''}
      ${layNote?`<div class="f-meta">Layover ${escH(layNote)}</div>`:''}
      ${path}${sepNote}${fund}</div>`;
  };
  const paint=()=>{
    if(seq!==flSeq||!leg) return;
    const view=rows=>applyFlightView(rows,v);
    const awAll=leg.options.filter(f=>f.points);
    const cashAll=leg.options.filter(f=>!f.points);
    const cash=view(cashAll);
    const awMain=view(awAll.filter(f=>f.cabin===trip.cabin));
    const awOther=view(awAll.filter(f=>f.cabin!==trip.cabin));
    disp=[...cash,...awMain,...awOther];
    const hidden=leg.options.length-disp.length;
    const singles=cashAll.filter(f=>!f.selfTransfer).map(f=>f.cash).filter(x=>x>0);
    const minSingle=singles.length?Math.min(...singles):null;
    // Live Google Flights rows arrive in the chosen cabin; only the free
    // cached feed is economy-bound.
    const cashIsCabin=trip.cabin==='Economy'||cash.some(f=>f.cabin===trip.cabin);
    const near=(leg.nearbyAwards??[]).map(n=>`${n.date} · ${(n.miles/1000).toFixed(0)}K ${SOURCES[n.programId]?.short??''} ${n.cabin}`).join(' · ');
    const list=(rows,off)=>rows.map((f,i)=>rowHTML(f,off+i,minSingle)).join('');
    const fold=(id,label,inner,open)=>`
      <button class="fold${open?' open':''}" id="${id}" type="button">${label} <span class="fold-c">${open?'▴':'▾'}</span></button>
      <div class="fold-body" data-for="${id}"${open?'':' style="display:none"'}>${inner}</div>`;
    const nAw=awMain.length+awOther.length;
    const ptsInner=`
      ${awMain.length?`<label class="minihead">${escH(trip.cabin)} · book with points${seats>1?` · ${seats} seats`:''}</label><div class="optlist" style="max-height:170px">${list(awMain,cash.length)}</div>`:''}
      ${!awMain.length?`<div class="hint"><b style="color:var(--ink)">No cached ${escH(trip.cabin)} award space on this date${awOther.length?' — other cabins do have seats':''}.</b>
        The free feed only refreshes when someone runs a live search on seats.aero.
        <a href="${seatsSearchLink(from.iata,to.iata,date)}" target="_blank" rel="noreferrer" style="color:var(--route)">Run one there ↗</a> (pre-filled, ~30s with your Pro login), then
        <button type="button" class="flre">↻ re-check</button> — fresh finds land straight back here.</div>`:''}
      ${awOther.length?`<label class="minihead">Other cabins</label><div class="optlist" style="max-height:150px">${list(awOther,cash.length+awMain.length)}</div>`:''}
      ${near?`<div class="hint">Award space on nearby dates: ${near}</div>`:''}`;
    const lim=limitNotes();
    const limNote=!lim?'':`<div class="hint" style="color:var(--route)">${
      lim.signin?'<b>Showing cached fares.</b> Sign in (Trips, top right) for live Google Flights prices in every cabin.'
      :lim.lines.map(escH).join('<br>')}</div>`;
    const viaNote=v.via?`<div class="hint">Routing through <b style="color:var(--ink)">${escH(v.via)}</b> — <button type="button" class="flre" id="fvViaClr">clear</button></div>`:'';
    const hidNote=hidden>0?`<div class="hint">${hidden} option${hidden!==1?'s':''} hidden by your filters.</div>`:'';
    const body=limNote+viaNote+(leg.options.length?`
      ${cash.length?`<label class="minihead">${cashIsCabin?'Live fares — pay cash':'Cached economy fares — pay cash'}${seats>1?` · total for ${seats} seats`:''}</label><div class="optlist" style="max-height:230px">${list(cash,0)}</div>`:''}
      ${!cash.length?`<div class="hint"><b style="color:var(--ink)">No ${cashAll.length?'cash fares match your filters':'cached cash fares for this date'}.</b> <a href="${gf}" target="_blank" rel="noreferrer" style="color:var(--route)">Check live prices on Google Flights ↗</a> — or pick from the points options below.</div>`:''}
      ${!cashIsCabin&&cash.length?`<div class="finenote">${escH(trip.cabin)} cash pricing isn't in the free fare cache — <a href="${gf}" target="_blank" rel="noreferrer" style="color:var(--route)">check ${escH(trip.cabin)} fares on Google Flights ↗</a></div>`:''}
      ${hidNote}
      ${fold('awPts',`✦ ${nAw?`${nAw} points option${nAw!==1?'s':''} for this leg`:'Points options for this leg'}`,ptsInner,!cash.length)}`
      :'<div class="hint">No live results for this route &amp; date yet — try another cabin, or pick "Decide later" and the flight desk keeps searching.</div>');
    shell(body);
    qcard.querySelectorAll('.fold').forEach(b=>b.onclick=()=>{
      const bd=qcard.querySelector(`.fold-body[data-for="${b.id}"]`);
      const open=bd.style.display==='none';
      bd.style.display=open?'':'none';
      b.classList.toggle('open',open);
      b.querySelector('.fold-c').textContent=open?'▴':'▾';
    });
    const clr=$('#fvViaClr'); if(clr) clr.onclick=()=>{ v.via=''; load(); };
    qcard.querySelectorAll('.fcard[data-i]').forEach(o=>o.onclick=()=>onPick(disp[+o.dataset.i]));
  };
  const load=()=>{
    leg=null;
    shell('<div class="hint" style="color:var(--route)">Searching live fares &amp; award space…</div>');
    Promise.all([
      liveFlights(from.iata,to.iata,date,trip.cabin,null,v.via||null,{minLay:v.minLay,mix:true}).catch(()=>null),
      liveAwards(from.iata,to.iata,date,trip.cabin).catch(()=>null),
    ]).then(([offers,awards])=>{
      if(seq!==flSeq) return;
      leg=mergeLiveAwards(mergeLiveLeg({options:[]},offers,trip.cabin),Array.isArray(awards)?awards:null,date);
      paint();
    });
  };
  load();
}
const viaItems=airports.filter(a=>a.large).map(a=>({a,_s:`${a.iata} ${a.city} ${a.name}`.toLowerCase()}));
function stepOutboundFlight(){
  stepFlight({
    from:trip.origin.airport, to:trip.dest.airport, date:trip.date,
    eyebrow:'Step 2 — Outbound flight', question:'Choose your flight', stub:'flight',
    onPick:(f)=>{ trip.outFlight=f;
      const cab={Economy:'ECON','Premium Economy':'PREM',Business:'BIZ',First:'FIRST'}[trip.cabin]??'';
      ticket('flight', f?`${f.points?(f.points*seatsOf()/1000).toFixed(0)+'K pts':'$'+Math.round(partyFare(f.cash,trip.pax)).toLocaleString()} <span class="iata">${cab}</span>`:'at the desk');
      hideCard(); toast(f?'Flight locked in — now the cities':'No problem — the flight desk keeps searching');
      stepItinerary(); },
    onBack:()=>{ frameSetup(); stepSetup(); },
  });
}
function stepReturnFlight(){
  const dep=trip.endAirport??trip.dest.airport;
  stepFlight({
    from:dep, to:trip.home, date:returnISO(),
    eyebrow:'Step 4 — The flight home', question:'Choose your return flight', stub:'return',
    onPick:(f)=>{ trip.backFlight=f;
      hideCard(); toast(f?'Return locked in — now the hotels':'You can choose at the desk — now the hotels');
      stepCityTour(0); },
    onBack:()=>trip.type==='oneway'?stepHome():stepItinerary(),
  });
}

/* ---- 3. cities and nights — any country, nights per stop, reorderable ---- */
const stopKey=s=>`${s.city}|${s.cc??''}`;
function stopFromCity(c,cc){ return refineStop({city:c.city,lat:c.lat,lon:c.lon,nights:2,airports:c.airports||[],cc:cc??c.cc??null}); }
/* An airport city's position is the middle of its airports (Tokyo sits
   between HND and NRT, over Chiba) — geocode the real center once so the
   hotel map, hotel search and hops start downtown. */
const centerCache=new Map();
function refineStop(st){
  if(st.refined) return st;
  const key=`${st.city}|${st.cc??''}`;
  const apply=c=>{ if(c){ st.lat=c.lat; st.lon=c.lon; } st.refined=true; return st; };
  st._refining=(centerCache.has(key)?Promise.resolve(centerCache.get(key)):geoSearch(st.city.replace(/\s*\(.+\)$/,'')).then(list=>{
    const near=st;
    const hit=(list??[]).find(g=>g.latitude!=null&&(!st.cc||String(g.country_code??'').toUpperCase()===st.cc)&&haversine(near,{lat:g.latitude,lon:g.longitude})<150);
    const c=hit?{lat:hit.latitude,lon:hit.longitude}:null; centerCache.set(key,c); return c;
  }).catch(()=>null)).then(apply);
  return st;
}
function stepItinerary(browseCC){
  ticket(null,null,'stops');
  setCountryMode(true);
  let cc=browseCC??a2Of(trip.dest.country);
  // You land in this city — most trips stay there first; remove it if not.
  if(!trip.stops.length&&trip.dest.gwCity){ trip.stops.push(stopFromCity(trip.dest.gwCity,a2Of(trip.dest.country))); }
  const render=()=>{
    const n=totalNights();
    const tripCCs=[...new Set([a2Of(trip.dest.country),...trip.stops.map(s=>s.cc)].filter(Boolean))];
    if(cc&&!tripCCs.includes(cc)) tripCCs.push(cc);
    const cities=citiesOf(cc).filter(c=>!trip.stops.find(s=>stopKey(s)===stopKey({city:c.city,cc})));
    const arr=arriveISO();
    let cursor=arr;
    const rows=trip.stops.map((s,i)=>{
      const ci=cursor, co=addDaysISO(cursor,s.nights); cursor=co;
      const foreign=s.cc&&s.cc!==a2Of(trip.dest.country);
      return `<div class="opt sel stoprow"><span class="iata">${fmtDate(ci).slice(0,6)}</span>
        <span class="nm">${s.city}<div class="sub">${s.nights} night${s.nights!==1?'s':''} · out ${fmtDate(co).slice(0,6)}${foreign?` · ${ccName(s.cc)}`:''}</div></span>
        <span class="stp">
          <button data-a="up" data-i="${i}" title="Move earlier" aria-label="Move ${s.city} earlier"${i===0?' disabled':''}>↑</button>
          <button data-a="down" data-i="${i}" title="Move later" aria-label="Move ${s.city} later"${i===trip.stops.length-1?' disabled':''}>↓</button>
          <button data-a="minus" data-i="${i}" aria-label="One fewer night in ${s.city}">−</button><span class="n">${s.nights}</span><button data-a="plus" data-i="${i}" aria-label="One more night in ${s.city}">+</button>
          <button data-a="x" data-i="${i}" title="Remove" aria-label="Remove ${s.city}">×</button></span></div>`;
    }).join('');
    showCard(`
      <div class="eyebrow">Step 3 — Cities and nights</div>
      <div class="question">Where are you staying?</div>
      <div class="tally ${trip.stops.length?'ok':''}">${trip.stops.length} stop${trip.stops.length!==1?'s':''} · <b>${n} night${n!==1?'s':''}</b>${trip.stops.length?` · ${fmtDate(arr).slice(0,6)} → ${fmtDate(cursor).slice(0,6)}`:''}</div>
      <div class="optlist" id="stopsNow">${rows||'<div class="hint">Nothing yet — search below, tap a suggestion, or tap a city dot on the map.</div>'}</div>
      ${trip.stops.length===1&&trip.stops[0].city===trip.dest.gwCity?.city?`<div class="hint sm">You land in ${trip.dest.gwCity.city}, so it starts as your first stop — remove it if you're heading straight on.</div>`:''}
      <div class="field"><label>Add a city — any country</label>
        <input type="text" id="inStop" placeholder="Type any city or town…" autocomplete="off">
        <div class="suggest" id="sgStop"></div>
      </div>
      <div class="ccchips">${tripCCs.map(x=>`<button type="button" class="apchip${x===cc?' on':''}" data-cc="${x}">${ccName(x)}</button>`).join('')}
        <span class="ccnote">or click another country on the map</span></div>
      <label class="minihead">Cities in ${ccName(cc)}</label>
      <div class="optlist" style="max-height:170px" id="sugg">${cities.slice(0,10).map((c,i)=>`
        <div class="opt" data-i="${i}"><span class="dot${c.large?'':' med'}"></span><span class="nm">${c.city}</span></div>`).join('')||'<div class="hint">Every airport city here is already a stop.</div>'}
      </div>
      <div class="row">
        <button class="btn red" id="go" ${trip.stops.length?'':'disabled'}>Continue →</button>
        <button class="btn ghost sm" id="bk">Back</button>
      </div>`);
    const sugg=cities.slice(0,10);
    $('#sugg').querySelectorAll('.opt').forEach(o=>o.onclick=()=>add(stopFromCity(sugg[+o.dataset.i],cc)));
    qcard.querySelectorAll('.ccchips .apchip').forEach(b=>b.onclick=()=>browse(b.dataset.cc));
    $('#stopsNow').querySelectorAll('button').forEach(b=>b.onclick=e=>{
      e.stopPropagation();
      const i=+b.dataset.i,s=trip.stops[i], a=b.dataset.a;
      if(a==='plus'){ if(s.nights<30) s.nights++; }
      else if(a==='minus'){ s.nights--; if(s.nights<1) trip.stops.splice(i,1); }
      else if(a==='up'&&i>0){ [trip.stops[i-1],trip.stops[i]]=[trip.stops[i],trip.stops[i-1]]; }
      else if(a==='down'&&i<trip.stops.length-1){ [trip.stops[i+1],trip.stops[i]]=[trip.stops[i],trip.stops[i+1]]; }
      else if(a==='x') trip.stops.splice(i,1);
      refresh();
    });
    $('#go').onclick=()=>{ if(!trip.stops.length) return; trip.nights=totalNights(); ticket('nights',trip.nights); ticket('stops',trip.stops.length);
      setCountryMode(false); clickHandler=null; hideCard(); stepReturn(); };
    $('#bk').onclick=()=>{ setCountryMode(false); clickHandler=null; clearDots(); gMarkers.selectAll('.stopbadge').remove(); stepOutboundFlight(); };
    // worldwide search: airport cities everywhere, plus geocoded towns
    const inp=$('#inStop'), sg=$('#sgStop');
    let townTimer=null;
    inp.oninput=()=>{
      const q=inp.value.trim().toLowerCase();
      clearTimeout(townTimer);
      if(!q){ sg.classList.remove('open'); sg.innerHTML=''; return; }
      const hits=placeItems.filter(it=>it.kind==='city'&&it._s.includes(q)&&!trip.stops.find(s=>stopKey(s)===stopKey({city:it.c.city,cc:it.cc})))
        .sort((a,b)=>placeRank(a,q)-placeRank(b,q)).slice(0,8);
      const draw=(towns=[])=>{
        sg.innerHTML=hits.map((it,i)=>`<div data-i="${i}"><span>${it.c.city}, ${ccName(it.cc)}</span><span class="code">${it.c.airports[0]?.iata??''}</span></div>`).join('')
          + towns.map((t,i)=>`<div data-t="${i}"><span>${t.name} · ${t.admin1?t.admin1+', ':''}${t.country}</span><span class="code">town</span></div>`).join('');
        sg.classList.toggle('open', hits.length>0||towns.length>0);
        sg.querySelectorAll('div[data-i]').forEach(d=>d.onclick=()=>{ const it=hits[+d.dataset.i]; add(stopFromCity(it.c,it.cc)); });
        sg.querySelectorAll('div[data-t]').forEach(d=>{
          const t=towns[+d.dataset.t];
          d.onclick=()=>add({city:t.name,lat:t.latitude,lon:t.longitude,nights:2,airports:[],cc:(t.country_code??'').toUpperCase()||null,refined:true});
        });
      };
      draw();
      if(q.length>=3) townTimer=setTimeout(async()=>{
        const towns=(await geoSearch(q)).filter(g=>g.latitude!=null&&!hits.some(h=>h.c.city.toLowerCase()===String(g.name).toLowerCase())&&!trip.stops.find(s=>s.city===g.name)).slice(0,4);
        if(inp.value.trim().toLowerCase()===q) draw(towns);
      },350);
    };
  };
  const refresh=()=>{ render(); drawStopBadges(trip.stops);
    drawCityDots(citiesOf(cc).filter(c=>!trip.stops.find(s=>stopKey(s)===stopKey({city:c.city,cc}))),c=>add(stopFromCity(c,cc)));
    const legs=[]; for(let i=0;i<trip.stops.length-1;i++)legs.push({a:trip.stops[i],b:trip.stops[i+1]});
    drawArcs(legs,false,true);
  };
  const browse=x=>{ cc=x; const f=countryByCC.get(x); if(f){ markCountry(f); zoomToFeature(f); } refresh(); };
  const add=s=>{
    if(totalNights()>=90){ toast('That is a long trip — 90 nights is the limit'); return; }
    trip.stops.push(s); refresh();
    s._refining?.then(()=>{ if(qcard.querySelector('#stopsNow')) drawStopBadges(trip.stops); });
  };
  clickHandler=f=>browse(a2Of(f));
  const f=countryByCC.get(cc); if(f){ markCountry(f); zoomToFeature(f); }
  refresh();
}

/* ---- 6b. city guide tour: live-area hotel search + attraction pins ---- */
function addDaysISO(iso,n){ const d=new Date(iso+'T12:00:00Z'); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10); }
function attractionListFor(name){
  const clean=name.replace(/\s*\(.+\)$/,'');
  const cur=searchCities(clean)[0];
  const pool=cur ? attractionsFor(cur.id) : [
    {n:`${clean} old town & landmarks walk`},{n:'Local market & food crawl'},
    {n:`${clean} viewpoint at sunset`},{n:'Top museum or gallery'},{n:'Neighborhood dinner, local pick'}];
  return pool.map(a=>a.n);
}
function drawHotelPins(hotels,nights){
  gMarkers.selectAll('g.hotelpin').remove();
  const data=hotels.filter(h=>h.lat!=null&&h.lon!=null);
  data.forEach(d=>d._p=proj([d.lon,d.lat]));
  const g=gMarkers.selectAll('g.hotelpin').data(data).join('g').attr('class','pos hotelpin');
  g.append('circle').attr('r',6.5);
  g.append('text').text(d=>'$'+Math.round(d.price/Math.max(nights,1))).attr('x',10).attr('y',4);
  place();
}
let tourSeq=0;
const tourFilters={ stars:0, rating:0, budget:0, group:'', sort:'price' };
const tourLayers={ sights:true, food:false, shop:false, districts:true };
const LAYERS=[['sights','◆ Sights'],['food','🍽 Restaurants'],['shop','🛍 Shopping'],['districts','▒ Nicer districts']];
const attrCache={};
const escT=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function stepCityTour(i){
  if(i>=trip.stops.length||i<0){ gMarkers.selectAll('.hotelpin').remove(); hideDetailMap(); return afterHotels(); }
  const s=trip.stops[i];
  if(s._refining&&!s.refined){ s._refining.finally(()=>stepCityTour(i)); return; }
  const seq=++tourSeq;
  const cityName=s.city.replace(/\s*\(.+\)$/,'');
  ticket(null,null,'stops');
  clearDots(); gMarkers.selectAll('.stopbadge,.hotelpin').remove(); gArcs.selectAll('*').remove();
  zoomToPoint([s.lon,s.lat], 40);
  let lead=0; for(let j=0;j<i;j++) lead+=trip.stops[j].nights;
  const ci=addDaysISO(arriveISO(),lead), co=addDaysISO(arriveISO(),lead+s.nights);
  const attractions=attractionListFor(s.city);
  const rooms=Math.max(1,Math.ceil(trip.pax.adults/2));
  const districts=districtsNear(s.lat,s.lon);

  let all=[];                              // latest unfiltered results for this area
  let state=liveMode()?'loading':'off';    // loading | ok | error | off
  let searching=false;                     // a pan/zoom re-search in flight
  let errMsg=null;
  let attrs=attrCache[cityName]??[];
  let view={lat:s.lat,lon:s.lon,radius:2500};
  let district=null;                       // the district card that's open
  const places={};                         // kind → [places] for the current area

  const nightly=h=>h.price/Math.max(s.nights,1);
  const passes=h=>{
    if(tourFilters.stars&&(h.stars??0)<tourFilters.stars) return false;
    if(tourFilters.rating&&h.rating!=null&&h.rating<tourFilters.rating) return false;
    if(tourFilters.budget&&nightly(h)>tourFilters.budget) return false;
    if(tourFilters.group&&(brandGroupOf(h.name)??'other')!==tourFilters.group) return false;
    if(tourFilters.refundable&&h.refundable!==true) return false;
    return true;
  };
  // Must-see ranking: average distance to the pinned sights.
  const nearSights=h=>attrs.length&&h.lat!=null?d3.mean(attrs,a=>haversine(h,a)):Infinity;
  const sorted=list=>tourFilters.sort==='rating'?[...list].sort((a,b)=>(b.rating??0)-(a.rating??0))
    :tourFilters.sort==='sights'?[...list].sort((a,b)=>nearSights(a)-nearSights(b)):list;
  const filtered=()=>sorted(all.filter(passes));
  // Price shading — the data-backed read on where the high end is.
  const tiers=()=>{
    const ps=all.map(nightly).sort((a,b)=>a-b);
    if(ps.length<4) return null;
    const lo=ps[Math.floor(ps.length/3)], hi=ps[Math.floor(2*ps.length/3)];
    return Object.fromEntries(all.map(h=>[h.name,nightly(h)>=hi?'high':nightly(h)<=lo?'low':'mid']));
  };
  const distStats=d=>{
    const inside=all.filter(h=>h.lat!=null&&inDistrict(h,d));
    return inside.length?{n:inside.length,typical:d3.median(inside,nightly)}:null;
  };

  const pushPins=()=>{
    const hs=filtered();
    const layerPlaces=['sights','food','shop'].filter(k=>tourLayers[k]).flatMap(k=>(places[k]??[]).map(p=>({...p,top:p.rank>=3})));
    const ok=showDetailMap(container,{
      lat:s.lat, lon:s.lon, pins:hs, attrs, nights:s.nights, fly:false,
      selected:trip.hotelPicks[s.city]?.name,
      places:layerPlaces, districts:tourLayers.districts?districts:[], tiers:tiers(),
      onPinClick:(h)=>{ if(seq!==tourSeq) return;
        trip.hotelPicks[s.city]=trip.hotelPicks[s.city]?.name===h.name?undefined:{...h,nights:s.nights};
        render(); pushPins(); },
      onViewChange:(area)=>{ if(seq!==tourSeq) return; view=area; if(state!=='off') fetchArea(area); loadPlaces(); },
      onDistrictClick:(d)=>{ if(seq!==tourSeq) return; district=d; render(); },
      onFail:()=>{ if(seq===tourSeq) drawHotelPins(hs,s.nights); },
    });
    if(!ok) drawHotelPins(hs,s.nights);
  };

  const loadPlaces=()=>{
    if(!liveMode()) return;
    for(const k of ['sights','food','shop']){
      if(!tourLayers[k]) continue;
      const at=view;
      livePlaces(at.lat,at.lon,Math.min(at.radius,4000),k).then(list=>{
        if(seq!==tourSeq||!Array.isArray(list)) return;
        places[k]=list.slice(0,k==='food'?45:35); pushPins();
      });
    }
  };

  const render=()=>{
    const hs=filtered();
    const hidden=all.length-all.filter(passes).length;
    const sel=(id,opts,val)=>`<select id="${id}" class="tsel">${opts.map(([v,l])=>`<option value="${v}"${String(val)===String(v)?' selected':''}>${l}</option>`).join('')}</select>`;
    const filterRow=`<div class="tfilters">
      ${sel('fStars',[[0,'★ any'],[3,'3★+'],[4,'4★+'],[5,'5★']],tourFilters.stars)}
      ${sel('fRating',[[0,'reviews any'],[7,'7+'],[8,'8+'],[9,'9+']],tourFilters.rating)}
      ${sel('fBudget',[[0,'$/nt any'],[150,'≤$150'],[250,'≤$250'],[400,'≤$400'],[700,'≤$700']],tourFilters.budget)}
      ${sel('fGroup',[['','group any'],...HOTEL_GROUPS.map(g=>[g.id,g.label]),['other','Independent']],tourFilters.group)}
      ${sel('fSort',[['price','sort: price'],['rating','sort: rating'],['sights',attrs.length?'sort: near sights':'near sights (pinning…)']],tourFilters.sort)}
      <label class="tchk" style="margin:4px 0 0"><input type="checkbox" id="fRef"${tourFilters.refundable?' checked':''}> Free cancellation only</label>
    </div>`;
    const dcard=district?(()=>{ const st=distStats(district);
      return `<div class="dcard"><div class="dn">${escT(district.name)}</div><div class="dk">${escT(district.known)}</div>
        <div class="dp">${st?`Typical rate here $${Math.round(st.typical).toLocaleString()}/nt · ${st.n} hotel${st.n!==1?'s':''} in view`:'No live rates inside it yet'}
        · <button type="button" class="flre" id="dSearch">search hotels here</button> · <button type="button" class="flre" id="dClose">close</button></div></div>`; })():'';
    const layerBar=`<div class="layerbar">${LAYERS.map(([k,l])=>`<button type="button" data-layer="${k}" class="${tourLayers[k]?'on':''}"${k==='districts'&&!districts.length?' title="Not mapped for this city yet — pins are shaded by price instead"':''}>${l}</button>`).join('')}</div>
      ${tourLayers.districts&&!districts.length?'<div class="hint sm" style="margin:-4px 0 8px">Nicer districts aren\'t mapped here yet — darker pins are the pricier hotels.</div>':''}`;
    const hotelBlock=
      state==='loading' ? '<div class="hint" style="color:var(--route)">Finding live hotel rates…</div>'
      : state==='error' ? `<div class="hint" style="color:var(--route)">Live rates unavailable — ${escT(errMsg)}.</div>
          <button class="btn ghost sm" id="rt">Retry</button>`
      : state==='off' ? '<div class="hint">Connect the worker (VITE_API_BASE) for live hotel rates.</div>'
      : filterRow+(all.some(h=>h.testRate)?'<div class="hint" style="color:var(--route)"><b>Test rates.</b> The hotel provider is in sandbox mode — these prices are simulated, not real.</div>':'')+(hs.length?`<label class="minihead">Where you could stay${rooms>1?` · ${rooms} rooms`:''} — pan or zoom the map to search that area</label>
        <div class="optlist" style="max-height:170px">${hs.slice(0,8).map((h,j)=>{
          const total=h.price*rooms;
          return `<div class="opt${trip.hotelPicks[s.city]?.name===h.name?' sel':''}" data-h="${j}">
            ${h.photo&&/^https:\/\//.test(h.photo)?`<img class="hrow-photo" src="${escT(h.photo)}" alt="" loading="lazy">`:`<span class="iata">$${Math.round(nightly(h))}</span>`}
            <span class="nm">${escT(h.name)}<div class="sub">${h.stars>0?`<span style="color:var(--gold)">${'★'.repeat(Math.min(h.stars,5))}</span>`:''}${h.rating!=null?` ${escT(h.rating)}/10`:''}${h.reviews?` · ${(+h.reviews).toLocaleString()} reviews`:''}${h.testRate?' · <span style="color:var(--route)">test rate</span>':''}</div>
              <div class="sub">${rooms>1?`${rooms} rooms · `:''}<b style="color:var(--ink);font-weight:500">$${Math.round(total).toLocaleString()} total</b>${h.dueAtHotel?` + $${h.dueAtHotel*rooms} at hotel`:''}${h.refundable===true?'<span class="htag">free cancellation</span>':''}${tourFilters.sort==='sights'&&nearSights(h)<Infinity?` · ${nearSights(h).toFixed(1)} km to sights`:''}</div></span>
          </div>`; }).join('')}</div>
        ${hidden>0?`<div class="hint">${hidden} more hidden by filters</div>`:''}`
        :`<div class="hint">${all.length?'Nothing matches these filters here — loosen one or move the map.':'No hotels in this area — pan or zoom the map to search elsewhere.'}</div>`);
    showCard(`
      <div class="eyebrow">Step 5 — Hotels · city ${i+1} of ${trip.stops.length}</div>
      <div class="question">${escT(s.city)}</div>
      <div class="hint">${s.nights} night${s.nights>1?'s':''} · ${fmtDate(ci)} → ${fmtDate(co)}${searching?' · <span style="color:var(--route)">searching this area…</span>':''}</div>
      <label class="minihead" style="margin-top:4px">Show on the map</label>
      ${layerBar}
      ${dcard}
      ${hotelBlock}
      ${attractions.length?`<label class="minihead">Don't miss</label>
        <div class="attrlist">${attractions.slice(0,5).map(a=>`<div>· ${escT(a)}</div>`).join('')}</div>`:''}
      <div class="row" style="margin-top:12px">
        <button class="btn red" id="nx">${i+1<trip.stops.length?'Next city →':'Continue →'}</button>
        <button class="btn ghost sm" id="bk">Back</button>
        <button class="btn ghost sm" id="skip">Skip tour</button>
      </div>`);
    const hsNow=hs;
    qcard.querySelectorAll('[data-h]').forEach(o=>o.onclick=()=>{
      const h=hsNow[+o.dataset.h];
      trip.hotelPicks[s.city]=trip.hotelPicks[s.city]?.name===h.name?undefined:{...h,nights:s.nights};
      render(); pushPins();
    });
    qcard.querySelectorAll('.layerbar button').forEach(b=>b.onclick=()=>{
      const k=b.dataset.layer; tourLayers[k]=!tourLayers[k];
      if(k==='districts'&&!tourLayers[k]) district=null;
      render(); pushPins(); if(tourLayers[k]&&k!=='districts') loadPlaces();
    });
    [['fStars','stars'],['fRating','rating'],['fBudget','budget']].forEach(([id,k])=>{
      const el=$('#'+id); if(el) el.onchange=()=>{ tourFilters[k]=+el.value; render(); pushPins(); };
    });
    const fg=$('#fGroup'); if(fg) fg.onchange=()=>{ tourFilters.group=fg.value; render(); pushPins(); };
    const fs=$('#fSort'); if(fs) fs.onchange=()=>{ tourFilters.sort=fs.value; render(); pushPins(); };
    const fr=$('#fRef'); if(fr) fr.onchange=()=>{ tourFilters.refundable=fr.checked; render(); pushPins(); };
    const ds=$('#dSearch'); if(ds) ds.onclick=()=>{ const d=district; flyDetail(d.lat,d.lon,14.2); fetchArea({lat:d.lat,lon:d.lon,radius:Math.round(d.r*1.6)}); };
    const dc=$('#dClose'); if(dc) dc.onclick=()=>{ district=null; render(); };
    const rt=$('#rt'); if(rt) rt.onclick=()=>stepCityTour(i);
    $('#nx').onclick=()=>stepCityTour(i+1);
    $('#bk').onclick=()=>{ if(i===0){ gMarkers.selectAll('.hotelpin').remove(); hideDetailMap(); clearDots();
        if(trip.type==='noreturn') stepItinerary(); else stepReturnFlight(); } else stepCityTour(i-1); };
    $('#skip').onclick=()=>stepCityTour(trip.stops.length);
  };

  const fetchArea=(area)=>{
    if(state==='ok'||state==='error'){ searching=true; render(); }
    const hardStop=new Promise(res=>setTimeout(()=>res({data:null,error:'no response after 25s'}),25000));
    Promise.race([
      liveHotelsDetailed({ custom:true, name:cityName, lat:area?.lat??s.lat, lon:area?.lon??s.lon }, ci, co, area?.radius),
      hardStop,
    ]).then(({data,error})=>{
      if(seq!==tourSeq) return;
      searching=false;
      try{
        if(error==='not-configured'){ state='off'; return render(); }
        if(error){ state='error'; errMsg=error; return render(); }
        state='ok';
        all=(data??[]).filter(h=>h.price&&h.name).sort((a,b)=>a.price-b.price);
        render(); pushPins();
      }catch(e){ state='error'; errMsg='display error: '+(e?.message??e); render(); }
    });
  };

  render();
  showDetailMap(container,{ lat:s.lat, lon:s.lon, pins:[], attrs, nights:s.nights, fly:true, districts:tourLayers.districts?districts:[] });
  if(liveMode()){ fetchArea(null); loadPlaces(); }

  // Geocode the top attractions once per city; pin them when found nearby.
  if(!attrCache[cityName]){
    (async()=>{
      const found=[];
      for(const a of attractions.slice(0,5)){
        const label=a.split(/[&,·(]/)[0].trim();
        if(label.length<3) continue;
        const hit=await searchPOI(`${label}, ${cityName}`);
        if(hit){
          const d=haversine({lat:s.lat,lon:s.lon},{lat:hit.lat,lon:hit.lon});
          if(d<35) found.push({ name:label, lat:hit.lat, lon:hit.lon });
        }
        await new Promise(r=>setTimeout(r,350)); // Nominatim rate courtesy
        if(seq!==tourSeq) return;
      }
      attrCache[cityName]=found;
      if(seq===tourSeq){ attrs=found; render(); pushPins(); }
    })();
  }
}

/* ---- 4. the way home — set by the trip type ---- */
/** Forward from the stops: round trips mirror the outbound, one-way trips
 *  pick both ends, no-return trips skip straight to the hotels. */
function stepReturn(){
  if(trip.type==='noreturn'){
    trip.endCity=null; trip.endAirport=null; trip.home=null; trip.backFlight=null;
    ticket('return','No return');
    return stepCityTour(0);
  }
  if(trip.type==='round'){
    trip.endCity=null; trip.endAirport=trip.dest.airport; trip.home=trip.origin.airport;
    ticket('return',`${trip.origin.city?.city??trip.home.city} <span class="iata">${trip.home.iata}</span>`);
    return stepReturnFlight();
  }
  stepEndCity();
}
function nearestAirports(lat,lon,n=3){
  return airports.filter(a=>a.large).map(a=>({a,d:haversine({lat,lon},a)}))
    .sort((x,y)=>x.d-y.d).slice(0,n).filter(x=>x.d<300).map(x=>x.a);
}
function stepEndCity(){
  ticket(null,null,'return');
  clearDots();
  const last=trip.stops.length-1;
  showCard(`
    <div class="eyebrow">Step 4 — The way home</div>
    <div class="question">Where does the way home start?</div>
    <div class="hint">One of your stops, or any other airport — the ride there is added between cities.</div>
    <div class="optlist">${trip.stops.map((s,i)=>`
      <div class="opt${i===last?' sel':''}" data-i="${i}"><span class="dot"></span>
        <span class="nm">${s.city}${i===last?'<div class="sub">Last stop — recommended</div>':''}</span></div>`).join('')}
    </div>
    <div class="field"><label>…or another city or airport</label>
      <input type="text" id="inEnd" placeholder="e.g. Seoul or ICN" autocomplete="off">
      <div class="suggest" id="sgEnd"></div>
    </div>
    <button class="backlink" id="bk">← adjust stops</button>`);
  qcard.querySelectorAll('.opt').forEach(o=>o.onclick=()=>{
    const s=trip.stops[+o.dataset.i];
    trip.endCity=s;
    hideCard(); stepEndAirport();
  });
  attachTypeahead($('#inEnd'),$('#sgEnd'),placeItems.filter(it=>it.kind!=='country'),placeHTML,it=>{
    const c=it.c, a=it.kind==='ap'?it.a:null;
    trip.endCity={city:c.city,lat:c.lat,lon:c.lon,airports:c.airports,cc:it.cc,offTrip:true};
    hideCard();
    if(a){ trip.endAirport=a; toast(`Return locked: departing ${a.iata} — ${c.city}`); stepHome(); }
    else stepEndAirport();
  },placeRank,24);
  $('#bk').onclick=()=>stepItinerary();
}
function stepEndAirport(){
  const sCity=trip.endCity;
  const aps=sCity.airports&&sCity.airports.length?sCity.airports:nearestAirports(sCity.lat,sCity.lon);
  function pick(a){ trip.endAirport=a; if(a) toast(`Return locked: departing ${a.iata} — ${sCity.city}`); hideCard(); clearDots(); stepHome(); }
  if(!aps.length){ trip.endAirport=trip.dest.airport; return stepHome(); }
  if(aps.length===1) return pick(aps[0]);
  drawCityDots(aps.map(a=>({city:a.iata+' · '+shortName(a),lat:a.lat,lon:a.lon,large:a.large,_ap:a})),d=>pick(d._ap),12);
  showCard(`
    <div class="eyebrow">Step 4 — The way home</div>
    <div class="question">Fly out of which airport?</div>
    <div class="hint">${sCity.city}${sCity.airports?.length?'':' has no airport of its own — these are the nearest'} — departure for the flight home.</div>
    <div class="optlist">${aps.map((a,i)=>`
      <div class="opt" data-i="${i}"><span class="iata">${a.iata}</span>
        <span class="nm">${a.name}<div class="sub">${a.city}${sCity.airports?.length?'':` · ${Math.round(haversine(sCity,a))} km away`}</div></span></div>`).join('')}
    </div>
    <button class="backlink" id="bk">← change where the way home starts</button>`);
  qcard.querySelectorAll('.opt').forEach(o=>o.onclick=()=>pick(aps[+o.dataset.i]));
  $('#bk').onclick=()=>{ clearDots(); stepEndCity(); };
}
function stepHome(){
  const o=trip.origin;
  showCard(`
    <div class="eyebrow">Step 4 — The way home</div>
    <div class="question">Where do you land?</div>
    <div class="optlist">
      <div class="opt sel" id="optHome"><span class="iata">${o.airport.iata}</span>
        <span class="nm">${o.airport.name}<div class="sub">Back where you started · ${o.city.city}</div></span></div>
    </div>
    <div class="field"><label>…or somewhere else</label>
      <input type="text" id="inHome" placeholder="Search any airport (city, name, or code)" autocomplete="off">
      <div class="suggest" id="sgHome"></div>
    </div>
    <button class="backlink" id="bk">← change where the way home starts</button>`);
  attachTypeahead($('#inHome'),$('#sgHome'),placeItems.filter(it=>it.kind==='ap'),placeHTML,it=>pick(it.a),placeRank,24);
  $('#optHome').onclick=()=>pick(o.airport);
  $('#bk').onclick=()=>stepEndCity();
  const pick=a=>{
    trip.home=a;
    ticket('return',`${a.city} <span class="iata">${a.iata}</span>`);
    hideCard();
    stepReturnFlight();
  };
}

/* ---- 6. between cities — every practical mode, priced for the party ---- */
const curatedId=name=>{ const c=searchCities(String(name).replace(/\s*\(.+\)$/,''))[0]; return c?.id??null; };
const placeOf=(x,name)=>({name,lat:x.lat,lon:x.lon,iso2:x.cc??x.iso2??null,iata:x.iata??x.airports?.[0]?.iata??null});
/** Ground hops in travel order: landing airport → first stop (when it
 *  isn't the landing city), stop → stop, last stop → the airport home. */
function buildHops(){
  const hops=[], stops=trip.stops;
  if(!stops.length) return hops;
  const ap=trip.dest.airport, first=stops[0];
  const apName=a=>`${(a.city??'').replace(/\s*\(.+\)$/,'')} (${a.iata})`;
  if(ap&&haversine(ap,first)>60) hops.push({key:`@${ap.iata}>${first.city}`,a:placeOf(ap,apName(ap)),b:placeOf(first,first.city),date:arriveISO(),
    rail:railEdge(curatedId(ap.city),curatedId(first.city))});
  let cursor=arriveISO();
  stops.forEach((s,i)=>{ cursor=addDaysISO(cursor,s.nights); const n=stops[i+1];
    if(n) hops.push({key:`${s.city}>${n.city}`,a:placeOf(s,s.city),b:placeOf(n,n.city),date:cursor,rail:railEdge(curatedId(s.city),curatedId(n.city))}); });
  const dep=trip.type==='noreturn'?null:(trip.endAirport??trip.dest.airport);
  const last=stops[stops.length-1];
  if(dep&&haversine(last,dep)>60) hops.push({key:`${last.city}>@${dep.iata}`,a:placeOf(last,last.city),b:placeOf(dep,apName(dep)),date:returnISO(),
    rail:railEdge(curatedId(last.city),curatedId(dep.city))});
  return hops.map(h=>({...h,...hopOptions({a:h.a,b:h.b,pax:trip.pax,rail:h.rail,date:h.date})}));
}
const hopChoice=h=>chosenOption(h,trip.hopModes[h.key]);
function afterHotels(){ return stepTransport(); }
function stepTransport(){
  ticket(null,null,'stops');
  hideDetailMap(); gMarkers.selectAll('.hotelpin').remove();
  const hops=buildHops();
  if(!hops.length){ return stepSummary(); }
  const draw=()=>{
    gArcs.selectAll('*').remove(); clearDots();
    drawStopBadges(trip.stops);
    drawArcs(hops.map(h=>({a:h.a,b:h.b,mode:hopChoice(h)?.mode==='flight'?'flight':'ground'})),false);
    const pts=hops.flatMap(h=>[proj([h.a.lon,h.a.lat]),proj([h.b.lon,h.b.lat])]);
    const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);
    return zoomToBounds([[d3.min(xs),d3.min(ys)],[d3.max(xs),d3.max(ys)]],0.3,DUR,Math.min(420,W*0.34));
  };
  const money=n=>`$${Math.round(n).toLocaleString()}`;
  const render=()=>{
    const total=d3.sum(hops,h=>hopChoice(h)?.total??0);
    showCard(`
      <div class="eyebrow">Step 6 — Between cities</div>
      <div class="question">How do you get around?</div>
      <div class="hint">Every practical way to make each hop, priced for ${paxLabel()}. Estimates until live rail, bus and ferry fares are connected — each one links to live times and prices.</div>
      ${hops.map((h,i)=>{ const ch=hopChoice(h);
        return `<div class="leg">
          <div class="lh"><span class="num">${i+1}</span><span class="rt">${h.a.name} → ${h.b.name}</span><span class="dist">${h.km.toLocaleString()} km · ${fmtDate(h.date).slice(0,6)}</span></div>
          ${h.options.length?`<div class="modes">${h.options.map(o=>`
            <button type="button" class="mode${ch?.id===o.id?' sel':''}" data-h="${i}" data-o="${o.id}">
              ${o.tags?.length?`<span class="best">${o.tags.join(' · ')}</span>`:''}
              <div class="mn">${o.icon} ${o.label}</div>
              <div class="md">${fmtMin(o.min)} · ${money(o.total)}${o.perVehicle?` · ${o.vehicles>1?o.vehicles+' cars':'per car'}`:''}</div>
            </button>`).join('')}</div>
            ${ch?`<div class="finenote" style="margin-top:8px">${ch.svc??''}${ch.note?` — ${ch.note}`:''}${ch.link?` · <a href="${ch.link}" target="_blank" rel="noreferrer" style="color:var(--route)">Live times &amp; prices ↗</a>`:''}</div>`:''}`
          :`<div class="hint">No practical surface or air option found — <a href="https://www.rome2rio.com/map/${encodeURIComponent(h.a.name)}/${encodeURIComponent(h.b.name)}" target="_blank" rel="noreferrer" style="color:var(--route)">check Rome2rio ↗</a></div>`}
        </div>`; }).join('')}
      <div class="totals"><div class="trow big"><span class="k">Getting around</span><span class="v">${money(total)} est.</span></div>
        <div class="trow"><span class="k">For</span><span class="v">${paxLabel()}</span></div></div>
      <div class="row" style="margin-top:12px">
        <button class="btn red" id="go">See the whole trip →</button>
        <button class="btn ghost sm" id="bk">Back</button>
      </div>`);
    qcard.querySelectorAll('.mode').forEach(b=>b.onclick=()=>{
      const h=hops[+b.dataset.h]; trip.hopModes[h.key]=b.dataset.o; render(); draw();
    });
    $('#go').onclick=()=>{ hideCard(); stepSummary(); };
    $('#bk').onclick=()=>{ hideCard(); stepCityTour(trip.stops.length-1); };
  };
  draw().then(()=>{}); render();
}

/* ---- 7. summary — the whole trip, then the desk prices every piece ---- */
function buildLegs(){
  const o=trip.origin, legs=[];
  const arr=trip.dest.airport;
  legs.push({a:{lat:o.airport.lat,lon:o.airport.lon,name:o.city.city+' '+o.airport.iata},
             b:{lat:arr.lat,lon:arr.lon,name:`${trip.dest.gwCity.city} ${arr.iata}`},kind:'intl',mode:'flight'});
  for(const h of buildHops()){ const ch=hopChoice(h); legs.push({a:h.a,b:h.b,kind:'inner',mode:ch?.mode==='flight'?'flight':'ground',hop:h,choice:ch}); }
  if(trip.type!=='noreturn'&&trip.home){
    const dep=trip.endAirport??arr;
    legs.push({a:{lat:dep.lat,lon:dep.lon,name:`${dep.city} ${dep.iata}`},b:{lat:trip.home.lat,lon:trip.home.lon,name:trip.home.city+' '+trip.home.iata},kind:'intl',mode:'flight'});
  }
  legs.forEach(l=>l.km=Math.round(haversine(l.a,l.b)));
  return legs;
}
function stepSummary(){
  const legs=buildLegs();
  const pts=legs.flatMap(l=>[proj([l.a.lon,l.a.lat]),proj([l.b.lon,l.b.lat])]);
  const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);
  clearDots(); gMarkers.selectAll('.homebadge').remove();
  drawStopBadges(trip.stops);
  drawHomeBadge({lat:trip.origin.airport.lat,lon:trip.origin.airport.lon},trip.origin.airport.iata);
  if(trip.home&&trip.home.iata!==trip.origin.airport.iata) drawHomeBadge({lat:trip.home.lat,lon:trip.home.lon},trip.home.iata);
  zoomToBounds([[d3.min(xs),d3.min(ys)],[d3.max(xs),d3.max(ys)]],0.22,DUR,Math.min(440,W*0.35)).then(()=>{
    drawArcs(legs);
    if(!RM) flyPlane(legs[0]);
  });
  ticket(null,null,null);
  const money=n=>`$${Math.round(n).toLocaleString()}`;
  const fl=[trip.outFlight,trip.backFlight].filter(Boolean);
  const flCash=d3.sum(fl.filter(f=>!f.points),f=>partyFare(f.cash,trip.pax));
  const flPts=d3.sum(fl.filter(f=>f.points),f=>f.points*seatsOf());
  const hotelCash=d3.sum(trip.stops,s=>{ const h=trip.hotelPicks[s.city]; return h?h.price*Math.max(1,Math.ceil(trip.pax.adults/2)):0; });
  const ground=d3.sum(legs.filter(l=>l.choice),l=>l.choice.total);
  const known=flCash+hotelCash+ground;
  const homeName=trip.type==='noreturn'?null:trip.home?.city;
  setTimeout(()=>{
    showCard(`
      <div class="eyebrow">Step 7 — Your trip</div>
      <div class="question">Your route, plotted.</div>
      <div class="hint">${trip.origin.city.city} → ${trip.stops.map(s=>s.city).join(' → ')}${homeName?` → ${homeName}`:' (no return)'}
        · ${totalNights()} night${totalNights()!==1?'s':''} · ${paxLabel()} · departs ${fmtDate(trip.date)}</div>
      <div class="totals" style="margin-top:4px">
        <div class="trow"><span class="k">Flights${fl.length<(trip.type==='noreturn'?1:2)?' (chosen so far)':''}</span><span class="v">${money(flCash)}${flPts?` + ${(flPts/1000).toFixed(0)}K pts`:''}</span></div>
        <div class="trow"><span class="k">Hotels picked on the map</span><span class="v">${money(hotelCash)}</span></div>
        <div class="trow"><span class="k">Between cities (est.)</span><span class="v">${money(ground)}</span></div>
        <div class="trow big"><span class="k">So far</span><span class="v">${money(known)}</span></div>
      </div>
      <div class="row" style="margin-top:14px">
        <button class="btn red" id="doneBtn">Price every piece →</button>
        <button class="btn ghost sm" id="editBtn">Edit stops</button>
        <button class="btn ghost sm" id="restartBtn">Start over</button>
      </div>
      <div class="finenote">Next: live fares and rates for your dates, anything you left for later, award space, and how to book each piece.</div>`);
    $('#doneBtn').onclick=()=>{
      const apOut=a=>a?{ iata:a.iata, name:a.name, lat:a.lat, lon:a.lon, city:a.city, iso2:a.cc }:null;
      const arrive=arriveISO();
      onComplete && onComplete({
        date: trip.date,
        tripType: trip.type,
        pax: { ...trip.pax },
        arriveLag: Math.max(0, Math.round((Date.parse(arrive)-Date.parse(trip.date))/86400000)),
        originCountry: nameOf(trip.origin.country),
        originCity: { name: trip.origin.city.city, lat: trip.origin.city.lat, lon: trip.origin.city.lon, iso2: a2Of(trip.origin.country) },
        originAirport: apOut(trip.origin.airport),
        destCountry: nameOf(trip.dest.country),
        arrivalCity: { name: trip.dest.gwCity.city, lat: trip.dest.gwCity.lat, lon: trip.dest.gwCity.lon },
        arrivalAirport: apOut(trip.dest.airport),
        endAirport: trip.type==='noreturn'?null:apOut(trip.endAirport??trip.dest.airport),
        cabin: trip.cabin,
        outFlight: trip.outFlight ?? null,
        backFlight: trip.backFlight ?? null,
        flightView: { ...trip.flightView },
        hotelPicks: Object.fromEntries(Object.entries(trip.hotelPicks).filter(([, v]) => v)),
        hotelPrefs: { stars: tourFilters.stars, rating: tourFilters.rating, budget: tourFilters.budget, group: tourFilters.group },
        stops: trip.stops.map(s=>({ name: s.city, lat: s.lat, lon: s.lon, nights: s.nights, iata: s.airports?.[0]?.iata ?? null, iso2: s.cc ?? null, country: s.cc?ccName(s.cc):nameOf(trip.dest.country) })),
        hopModes: { ...trip.hopModes },
        endCity: trip.endCity?.city ?? null,
        homeAirport: trip.type==='noreturn'?null:apOut(trip.home),
      });
    };
    $('#editBtn').onclick=()=>{ hideCard(); gArcs.selectAll('*').remove();
      gMarkers.selectAll('.homebadge').remove(); stepItinerary(); };
    $('#restartBtn').onclick=resetTrip;
  }, RM?0:1100);
}
function flyPlane(leg){
  const ip=d3.geoInterpolate([leg.a.lon,leg.a.lat],[leg.b.lon,leg.b.lat]);
  const g=gMarkers.append('g').attr('class','planeg');
  g.append('path').attr('class','plane')
    .attr('d','M0,-6 L1.6,-1.4 6,1.2 6,2.6 1.4,1.6 1.2,4.6 2.8,6 2.8,7 0,6.2 -2.8,7 -2.8,6 -1.2,4.6 -1.4,1.6 -6,2.6 -6,1.2 -1.6,-1.4 Z');
  const t0=performance.now(),D=2600;
  function frame(t){
    const u=Math.min(1,(t-t0)/D);
    const p=curT.apply(proj(ip(u))),p2=curT.apply(proj(ip(Math.min(1,u+.01))));
    const ang=Math.atan2(p2[1]-p[1],p2[0]-p[0])*180/Math.PI+90;
    g.attr('transform',`translate(${p}) scale(1.4) rotate(${ang})`);
    if(u<1) requestAnimationFrame(frame); else g.transition().duration(600).style('opacity',0).remove();
  }
  requestAnimationFrame(frame);
}
// ---- boot ------------------------------------------------------
const stopGlobe = skipIntro ? ()=>{} : mountIntroGlobe(container.querySelector('#introGlobe'));
$('#beginBtn').onclick=()=>{
  $('#intro').classList.add('hide');
  setTimeout(stopGlobe, 900); // after the fade — no point spinning a hidden globe
  $('#ticket').classList.add('show');
  setTimeout(()=>stepSetup(), RM?0:350);
};
// A restart from the desk lands straight on trip setup — no intro again.
if(skipIntro){ $('#intro').classList.add('hide'); $('#ticket').classList.add('show'); setTimeout(()=>stepSetup(), 60); }
return () => { stopGlobe(); destroyDetailMap(); container.innerHTML = ''; };
}
