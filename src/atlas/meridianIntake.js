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
import { geoSearch, liveHotelsDetailed, liveMode, searchPOI } from "../api/client.js";
import { showDetailMap, hideDetailMap, destroyDetailMap } from "./detailMap.js";
import { HOTEL_GROUPS, brandGroupOf } from "../lib/hotelBrands.js";
import { searchCities } from "../data/world.js";
import { attractionsFor } from "../lib/trip.js";
import "./meridian.css";

const SCAFFOLD = `
<div id="map"></div>
<div id="banner" aria-hidden="true">
  <div id="kicker"></div>
  <div id="bannerQ"></div>
</div>
<div id="intro">
  <div class="inner">
    <div class="kick">Private trip atelier</div>
    <h1>Meridian<span>Chart your journey across the night atlas</span></h1>
    <div class="rule"></div>
    <button class="btn red" id="beginBtn">Begin plotting &nbsp;→</button>
  </div>
</div>
<div id="qcard"></div>
<div id="ticket">
  <div class="rail-head">
    <div class="mark"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.5 15.5l-8-4.7V4.2c0-.9-.7-1.7-1.5-1.7s-1.5.8-1.5 1.7v6.6l-8 4.7v2l8-2.5v5.4l-2 1.6v1.5l3.5-1 3.5 1V22l-2-1.6V15l8 2.5v-2z"/></svg></div>
    <div>
      <div class="brand">Meridian <em>Noir</em></div>
      <div class="brand-sub">Points-first itineraries</div>
    </div>
  </div>
  <div id="railBody">
    <div class="tseg" data-step="from"><div class="tl">From</div><div class="tv" id="t-from">———</div></div>
    <div class="tseg" data-step="date"><div class="tl">Departs</div><div class="tv" id="t-date">———</div></div>
    <div class="tseg" data-step="to"><div class="tl">To</div><div class="tv" id="t-to">———</div></div>
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

export function mountMeridian(container, { onComplete, initialDate } = {}) {
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
      large:aps.some(d=>d.large), n:aps.length, airports:aps.slice().sort((a,b)=>(b.large-a.large))});
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
  gCountries.selectAll('path').attr('stroke-width', .5/Math.sqrt(curT.k));
  root.select('.graticule').attr('stroke-width', .4/Math.sqrt(curT.k));
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
  gArcs.selectAll('path.routearc').attr('d',function(){
    const pts=d3.select(this).datum().pts; return d3.line()(pts.map(p=>t.apply(p)));});
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
function hideCard(){ qcard.classList.remove('show'); }
const FOOT_LABELS={from:'Choosing origin',date:'Setting departure',to:'Choosing destination',nights:'Allocating nights',stops:'Plotting the route',return:'Return & home'};
function ticket(seg,val,active){
  const el = $('#t-'+seg);
  if(val!==undefined && val!==null){ el.innerHTML=val; el.closest('.tseg').classList.add('done'); }
  container.querySelectorAll('.tseg').forEach(s=>s.classList.remove('active'));
  if(active) document.querySelector(`.tseg[data-step="${active}"]`)?.classList.add('active');
  const fs=$('#footStatus'); if(fs) fs.textContent=active?FOOT_LABELS[active]??'En route':'Journey plotted';
}

// typeahead
function attachTypeahead(input, listEl, items, render, onPick){
  let hi=-1, view=[];
  const draw=()=>{ listEl.innerHTML=view.slice(0,40).map((it,i)=>`<div data-i="${i}" class="${i===hi?'hi':''}">${render(it)}</div>`).join('');
    listEl.classList.toggle('open',view.length>0);
    listEl.querySelectorAll('div').forEach(d=>d.onclick=()=>{onPick(view[+d.dataset.i]); listEl.classList.remove('open');}); };
  input.addEventListener('input',()=>{
    const q=input.value.trim().toLowerCase(); hi=-1;
    if(!q){view=[];draw();return;}
    view=items.filter(it=>it._s.includes(q)).sort((a,b)=>a._s.indexOf(q)-b._s.indexOf(q));
    draw();
  });
  input.addEventListener('keydown',e=>{
    if(e.key==='ArrowDown'){hi=Math.min(hi+1,Math.min(view.length,40)-1);draw();e.preventDefault();}
    else if(e.key==='ArrowUp'){hi=Math.max(hi-1,0);draw();e.preventDefault();}
    else if(e.key==='Enter'&&view.length){onPick(view[hi<0?0:hi]);listEl.classList.remove('open');e.preventDefault();}
    else if(e.key==='Escape'){listEl.classList.remove('open');}
  });
}
const countryItems = countries.map(f=>({f,_s:nameOf(f).toLowerCase()}));
Object.entries(ALIASES).forEach(([alias,nm])=>{
  const f=countries.find(c=>nameOf(c)===nm); if(f) countryItems.push({f,alias,_s:alias});
});

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
    p.attr('d',d3.line()(p.datum().pts.map(q=>curT.apply(q))));
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
const trip = {
  date:null,
  origin:{country:null,city:null,airport:null},
  dest:{country:null,gwCity:null,airport:null},
  nights:0,
  stops:[],           // {city,lat,lon,nights,airports}
  endCity:null, endAirport:null, hotelPicks:{},
  home:null,          // airport flying back to
  legModes:[]
};

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
  hideCard(); hideDetailMap(); tourSeq++;
  gMarkers.selectAll('.hotelpin').remove();
  Object.assign(trip,{date:null,origin:{country:null,city:null,airport:null},dest:{country:null,gwCity:null,airport:null},nights:0,stops:[],endCity:null,endAirport:null,hotelPicks:{},home:null,legModes:[]});
  container.querySelectorAll('.tseg').forEach(s=>s.classList.remove('done'));
  ['from','date','to','nights','stops','return'].forEach(k=>{ const el=$('#t-'+k); if(el) el.textContent='———'; });
  stepOriginCountry();
}
container.querySelector('#railRestart')?.addEventListener('click',resetTrip);

/* ---- 1. origin country + date ---- */
function stepOriginCountry(){
  clearDots(); gArcs.selectAll('*').remove(); gMarkers.selectAll('.stopbadge,.homebadge').remove();
  cSel.classed('selected',false).classed('dim',false);
  setCountryMode(true);
  ticket(null,null,'from');
  zoomOut();
  const today=new Date(); today.setDate(today.getDate()+14);
  const defDate=trip.date||initialDate||today.toISOString().slice(0,10);
  showCard(`
    <div class="eyebrow">Leg 01 — Origin</div>
    <div class="question">Where do you want to start?</div>
    <div class="hint">Click a country on the map, or start typing.</div>
    <div class="field"><label>Country</label>
      <input type="text" id="inCountry" placeholder="e.g. United States" autocomplete="off">
      <div class="suggest" id="sgCountry"></div>
    </div>
    <div class="field"><label>Departure date</label>
      <input type="date" id="inDate" value="${defDate}">
    </div>`);
  const inp=$('#inCountry');
  attachTypeahead(inp,$('#sgCountry'),countryItems,
    it=>`<span>${nameOf(it.f)}</span>${it.alias?`<span class="code">${it.alias.toUpperCase()}</span>`:''}`,
    it=>pick(it.f));
  setTimeout(()=>inp.focus(),450);
  const pick=f=>{
    trip.date=$('#inDate').value;
    trip.origin.country=f;
    ticket('date',fmtDate(trip.date));
    setCountryMode(false); markCountry(f);
    hideCard();
    zoomToFeature(f).then(()=>stepOriginCity());
  };
  clickHandler=pick;
}

/* ---- 2. origin city ---- */
function stepOriginCity(){
  ticket(null,null,'from');
  const cc=a2Of(trip.origin.country);
  const cities=citiesOf(cc);
  if(!cities.length){ toast('No scheduled airports found there — pick another country'); return stepOriginCountry(); }
  const items=cities.map(c=>({c,_s:c.city.toLowerCase()}));
  showCard(`
    <div class="eyebrow">Leg 01 — Origin · ${nameOf(trip.origin.country)}</div>
    <div class="question">Which city do you fly out of?</div>
    <div class="hint">Tap a dot on the map or search below.</div>
    <div class="field"><label>City</label>
      <input type="text" id="inCity" placeholder="Search cities…" autocomplete="off">
      <div class="suggest" id="sgCity"></div>
    </div>
    <div class="optlist" id="cityList">${cities.slice(0,8).map((c,i)=>`
      <div class="opt" data-i="${i}"><span class="dot${c.large?'':' med'}"></span>
        <span class="nm">${c.city}<div class="sub">${c.n} airport${c.n>1?'s':''}</div></span></div>`).join('')}
    </div>
    <button class="backlink" id="bk">← change country</button>`);
  function pick(c){ trip.origin.city=c; hideCard(); clearDots();
    zoomToPoint([c.lon,c.lat], c.airports.length>1?18:26).then(()=>stepOriginAirport()); }
  drawCityDots(cities,pick);
  attachTypeahead($('#inCity'),$('#sgCity'),items,it=>`<span>${it.c.city}</span>`,it=>pick(it.c));
  $('#cityList').querySelectorAll('.opt').forEach(o=>o.onclick=()=>pick(cities[+o.dataset.i]));
  $('#bk').onclick=()=>{ trip.origin.country=null; stepOriginCountry(); };
  clickHandler=null;
}

/* ---- 3. origin airport ---- */
function stepOriginAirport(){
  const c=trip.origin.city;
  function pick(a){
    trip.origin.airport=a;
    ticket('from',`${c.city} <span class="iata">${a.iata}</span>`);
    hideCard(); clearDots();
    toast(`Origin locked: ${a.iata} — ${c.city}`);
    stepDestCountry();
  }
  drawCityDots(c.airports.map(a=>({city:a.iata+' · '+shortName(a),lat:a.lat,lon:a.lon,large:a.large,_ap:a})),d=>pick(d._ap),12);
  showCard(`
    <div class="eyebrow">Leg 01 — Origin · ${c.city}</div>
    <div class="question">Choose your departure airport</div>
    <div class="optlist">${c.airports.map((a,i)=>`
      <div class="opt" data-i="${i}"><span class="iata">${a.iata}</span>
        <span class="nm">${a.name}<div class="sub">${a.large?'Major international':'Regional'}</div></span></div>`).join('')}
    </div>
    <button class="backlink" id="bk">← change city</button>`);
  qcard.querySelectorAll('.opt').forEach(o=>o.onclick=()=>pick(c.airports[+o.dataset.i]));
  $('#bk').onclick=()=>{ zoomToFeature(trip.origin.country).then(()=>stepOriginCity()); };
}
function shortName(a){ return a.name.replace(/ International| Airport| Regional/g,'').trim(); }

/* ---- 4. destination country ---- */
function stepDestCountry(){
  cSel.classed('selected',false);
  setCountryMode(true);
  ticket(null,null,'to');
  zoomOut();
  showCard(`
    <div class="eyebrow">Leg 02 — Destination</div>
    <div class="question">Where do you want to go?</div>
    <div class="hint">Click your destination country, or search.</div>
    <div class="field"><label>Country</label>
      <input type="text" id="inCountry2" placeholder="e.g. Japan" autocomplete="off">
      <div class="suggest" id="sgCountry2"></div>
    </div>
    <button class="backlink" id="bk">← back to origin</button>`);
  attachTypeahead($('#inCountry2'),$('#sgCountry2'),countryItems,
    it=>`<span>${nameOf(it.f)}</span>${it.alias?`<span class="code">${it.alias.toUpperCase()}</span>`:''}`,
    it=>pick(it.f));
  $('#bk').onclick=()=>stepOriginCountry();
  setTimeout(()=>$('#inCountry2')?.focus(),450);
  const pick=f=>{
    if(f===trip.origin.country){ /* allowed – domestic trips are fine */ }
    trip.dest.country=f;
    setCountryMode(false);
    cSel.classed('selected',d=>d===f||d===trip.origin.country);
    hideCard();
    zoomToFeature(f).then(()=>stepArrivalCity());
  };
  clickHandler=pick;
}

/* ---- 4b. arrival city — the trip starts here ---- */
function stepArrivalCity(){
  ticket(null,null,'to');
  const cc=a2Of(trip.dest.country);
  const cities=citiesOf(cc);
  if(!cities.length){ toast('No scheduled airports found there — pick another country'); return stepDestCountry(); }
  const items=cities.map(c=>({c,_s:c.city.toLowerCase()}));
  showCard(`
    <div class="eyebrow">Leg 02 — Destination · ${nameOf(trip.dest.country)}</div>
    <div class="question">Which city do you land in?</div>
    <div class="hint">Your trip starts here — the outbound flight arrives at this city's airport.</div>
    <div class="field"><label>City</label>
      <input type="text" id="inCityA" placeholder="Search cities…" autocomplete="off">
      <div class="suggest" id="sgCityA"></div>
    </div>
    <div class="optlist" id="cityListA">${cities.slice(0,8).map((c,i)=>`
      <div class="opt" data-i="${i}"><span class="dot${c.large?'':' med'}"></span>
        <span class="nm">${c.city}<div class="sub">${c.n} airport${c.n>1?'s':''}</div></span></div>`).join('')}
    </div>
    <button class="backlink" id="bk">← change country</button>`);
  function pick(c){ trip.dest.gwCity=c; hideCard(); clearDots();
    zoomToPoint([c.lon,c.lat], c.airports.length>1?18:26).then(()=>stepArrivalAirport()); }
  drawCityDots(cities,pick);
  attachTypeahead($('#inCityA'),$('#sgCityA'),items,it=>`<span>${it.c.city}</span>`,it=>pick(it.c));
  $('#cityListA').querySelectorAll('.opt').forEach(o=>o.onclick=()=>pick(cities[+o.dataset.i]));
  $('#bk').onclick=()=>stepDestCountry();
  clickHandler=null;
}

/* ---- 4c. arrival airport ---- */
function stepArrivalAirport(){
  const c=trip.dest.gwCity;
  function pick(a){
    trip.dest.airport=a;
    ticket('to',`${c.city} <span class="iata">${a.iata}</span>`);
    hideCard(); clearDots();
    toast(`Landing locked: ${a.iata} — ${c.city}`);
    zoomToFeature(trip.dest.country).then(()=>stepNights());
  }
  if(c.airports.length===1) return pick(c.airports[0]);
  drawCityDots(c.airports.map(a=>({city:a.iata+' · '+shortName(a),lat:a.lat,lon:a.lon,large:a.large,_ap:a})),d=>pick(d._ap),12);
  showCard(`
    <div class="eyebrow">Leg 02 — Destination · ${c.city}</div>
    <div class="question">Choose your arrival airport</div>
    <div class="optlist">${c.airports.map((a,i)=>`
      <div class="opt" data-i="${i}"><span class="iata">${a.iata}</span>
        <span class="nm">${a.name}<div class="sub">${a.large?'Major international':'Regional'}</div></span></div>`).join('')}
    </div>
    <button class="backlink" id="bk">← change city</button>`);
  qcard.querySelectorAll('.opt').forEach(o=>o.onclick=()=>pick(c.airports[+o.dataset.i]));
  $('#bk').onclick=()=>{ zoomToFeature(trip.dest.country).then(()=>stepArrivalCity()); };
}

/* ---- 5. nights ---- */
function stepNights(){
  ticket(null,null,'nights');
  showCard(`
    <div class="eyebrow">Leg 02 — ${nameOf(trip.dest.country)}</div>
    <div class="question">How many nights?</div>
    <div class="hint">You land in ${trip.dest.gwCity.city} (${trip.dest.airport.iata}) &mdash; add it as a stop next if you are staying.</div>
    <div class="field"><label>Total nights in ${nameOf(trip.dest.country)}</label>
      <input type="number" id="inNights" min="1" max="60" value="${trip.nights||7}">
    </div>
    <div class="row">
      <button class="btn red" id="go">Plot the stops →</button>
      <button class="btn ghost sm" id="bk">Back</button>
    </div>`);
  $('#go').onclick=()=>{
    const n=+$('#inNights').value;
    if(!(n>=1&&n<=60)) return toast('Enter between 1 and 60 nights');
    trip.nights=n; trip.stops=[];
    ticket('nights',n);
    stepItinerary();
  };
  $('#bk').onclick=()=>stepDestCountry();
  setTimeout(()=>$('#inNights')?.select(),450);
}

/* ---- 6. itinerary stops ---- */
function stepItinerary(){
  ticket(null,null,'stops');
  const cc=a2Of(trip.dest.country);
  const cities=citiesOf(cc);
  const render=()=>{
    const used=d3.sum(trip.stops,s=>s.nights);
    const left=trip.nights-used;
    const tallyCls=left===0?'ok':(left<0?'over':'');
    showCard(`
      <div class="eyebrow">Leg 02 — Itinerary</div>
      <div class="question">Pick a city for each night</div>
      <div class="tally ${tallyCls}">Nights assigned: <b>${used} / ${trip.nights}</b>${left>0?` · ${left} left`:left<0?' · too many':' · complete'}</div>
      <div class="optlist" id="stopsNow">${trip.stops.map((s,i)=>{
        let from=1; for(let j=0;j<i;j++) from+=trip.stops[j].nights;
        const to=from+s.nights-1;
        return `<div class="opt sel"><span class="iata">N${s.nights>1?from+'–'+to:from}</span>
          <span class="nm">${s.city}</span>
          <span class="stp"><button data-a="minus" data-i="${i}">−</button><span class="n">${s.nights}</span><button data-a="plus" data-i="${i}">+</button><button data-a="x" data-i="${i}" title="remove">×</button></span></div>`;
      }).join('')||'<div class="hint">Nothing yet — tap suggested cities below or dots on the map. Each stop starts at one night; use + / − to adjust.</div>'}</div>
      <div class="field"><label>Search a city or town</label>
        <input type="text" id="inStop" placeholder="Type any city — or a smaller town…" autocomplete="off">
        <div class="suggest" id="sgStop"></div>
      </div>
      <label style="font-family:var(--mono);font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-soft)">Suggested cities</label>
      <div class="optlist" style="max-height:170px" id="sugg">${cities.filter(c=>!trip.stops.find(s=>s.city===c.city)).slice(0,10).map((c,i)=>`
        <div class="opt" data-i="${i}"><span class="dot${c.large?'':' med'}"></span><span class="nm">${c.city}</span></div>`).join('')}
      </div>
      <div class="row">
        <button class="btn red" id="go" ${left!==0?'disabled':''}>Continue →</button>
        <button class="btn ghost sm" id="bk">Back</button>
      </div>`);
    const suggCities=cities.filter(c=>!trip.stops.find(s=>s.city===c.city)).slice(0,10);
    $('#sugg').querySelectorAll('.opt').forEach(o=>o.onclick=()=>add(suggCities[+o.dataset.i]));
    $('#stopsNow').querySelectorAll('button').forEach(b=>b.onclick=e=>{
      e.stopPropagation();
      const i=+b.dataset.i,s=trip.stops[i];
      if(b.dataset.a==='plus')s.nights++;
      else if(b.dataset.a==='minus'){s.nights--; if(s.nights<1)trip.stops.splice(i,1);}
      else trip.stops.splice(i,1);
      refresh();
    });
    $('#go').onclick=()=>{ if(d3.sum(trip.stops,s=>s.nights)!==trip.nights)return; hideCard(); stepCityTour(0); };
    $('#bk').onclick=()=>{ clearDots(); gMarkers.selectAll('.stopbadge').remove(); stepNights(); };
    // free-text search: every airport city in the country, plus geocoded towns
    const inp=$('#inStop'), sg=$('#sgStop');
    let townTimer=null;
    inp.oninput=()=>{
      const q=inp.value.trim().toLowerCase();
      clearTimeout(townTimer);
      if(!q){ sg.classList.remove('open'); sg.innerHTML=''; return; }
      const hits=cities.filter(c=>!trip.stops.find(s=>s.city===c.city)&&c.city.toLowerCase().includes(q)).slice(0,8);
      const draw=(towns=[])=>{
        sg.innerHTML=hits.map((c,i)=>`<div data-i="${i}"><span>${c.city}</span></div>`).join('')
          + towns.map((t,i)=>`<div data-t="${i}"><span>${t.name} · ${t.admin1?t.admin1+', ':''}${t.country}</span><span class="code">town</span></div>`).join('');
        sg.classList.toggle('open', hits.length>0||towns.length>0);
        sg.querySelectorAll('div[data-i]').forEach(d=>d.onclick=()=>add(hits[+d.dataset.i]));
        sg.querySelectorAll('div[data-t]').forEach(d=>{
          const t=towns[+d.dataset.t];
          d.onclick=()=>add({city:t.name,lat:t.latitude,lon:t.longitude,airports:[]});
        });
      };
      draw();
      if(q.length>=3) townTimer=setTimeout(async()=>{
        const towns=(await geoSearch(q)).filter(g=>g.latitude!=null&&!trip.stops.find(s=>s.city===g.name)).slice(0,4);
        if(inp.value.trim().toLowerCase()===q) draw(towns);
      },350);
    };
  };
  const refresh=()=>{ render(); drawStopBadges(trip.stops);
    drawCityDots(citiesOf(cc).filter(c=>!trip.stops.find(s=>s.city===c.city)),add); 
    // sequential arcs between stops
    const legs=[]; for(let i=0;i<trip.stops.length-1;i++)legs.push({a:trip.stops[i],b:trip.stops[i+1]});
    drawArcs(legs,false,true);
  };
  const add=c=>{
    const used=d3.sum(trip.stops,s=>s.nights);
    if(used>=trip.nights){ toast('All nights are assigned — remove one first or use −'); return; }
    trip.stops.push({city:c.city,lat:c.lat,lon:c.lon,nights:1,airports:c.airports||[]});
    refresh();
  };
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
const tourFilters={ stars:0, rating:0, budget:0, group:'' };
const attrCache={};
function stepCityTour(i){
  if(i>=trip.stops.length||i<0){ gMarkers.selectAll('.hotelpin').remove(); hideDetailMap(); return stepEndCity(); }
  const seq=++tourSeq;
  const s=trip.stops[i];
  const cityName=s.city.replace(/\s*\(.+\)$/,'');
  ticket(null,null,'stops');
  clearDots(); gMarkers.selectAll('.stopbadge,.hotelpin').remove(); gArcs.selectAll('*').remove();
  zoomToPoint([s.lon,s.lat], 40);
  let lead=1; for(let j=0;j<i;j++) lead+=trip.stops[j].nights;
  const ci=addDaysISO(trip.date,lead), co=addDaysISO(trip.date,lead+s.nights);
  const attractions=attractionListFor(s.city);

  let all=[];                              // latest unfiltered results for this area
  let state=liveMode()?'loading':'off';    // loading | ok | error | off
  let searching=false;                     // a pan/zoom re-search in flight
  let errMsg=null;
  let attrs=attrCache[cityName]??[];

  const passes=h=>{
    const nightly=h.price/Math.max(s.nights,1);
    if(tourFilters.stars&&(h.stars??0)<tourFilters.stars) return false;
    if(tourFilters.rating&&h.rating!=null&&h.rating<tourFilters.rating) return false;
    if(tourFilters.budget&&nightly>tourFilters.budget) return false;
    if(tourFilters.group&&(brandGroupOf(h.name)??'other')!==tourFilters.group) return false;
    return true;
  };
  const filtered=()=>all.filter(passes);

  const pushPins=()=>{
    const hs=filtered();
    const ok=showDetailMap(container,{
      lat:s.lat, lon:s.lon, pins:hs, attrs, nights:s.nights, fly:false,
      selected:trip.hotelPicks[s.city]?.name,
      onPinClick:(h)=>{ if(seq!==tourSeq) return;
        trip.hotelPicks[s.city]=trip.hotelPicks[s.city]?.name===h.name?undefined:{...h,nights:s.nights};
        render(); pushPins(); },
      onViewChange:(area)=>{ if(seq===tourSeq&&state!=='off') fetchArea(area); },
      onFail:()=>{ if(seq===tourSeq) drawHotelPins(hs,s.nights); },
    });
    if(!ok) drawHotelPins(hs,s.nights);
  };

  const render=()=>{
    const hs=filtered();
    const hidden=all.length-hs.length;
    const sel=(id,opts,val)=>`<select id="${id}" class="tsel">${opts.map(([v,l])=>`<option value="${v}"${String(val)===String(v)?' selected':''}>${l}</option>`).join('')}</select>`;
    const filterRow=`<div class="tfilters">
      ${sel('fStars',[[0,'★ any'],[3,'3★+'],[4,'4★+'],[5,'5★']],tourFilters.stars)}
      ${sel('fRating',[[0,'reviews any'],[7,'7+'],[8,'8+'],[9,'9+']],tourFilters.rating)}
      ${sel('fBudget',[[0,'$/nt any'],[150,'≤$150'],[250,'≤$250'],[400,'≤$400'],[700,'≤$700']],tourFilters.budget)}
      ${sel('fGroup',[['','group any'],...HOTEL_GROUPS.map(g=>[g.id,g.label]),['other','Independent']],tourFilters.group)}
    </div>`;
    const hotelBlock=
      state==='loading' ? '<div class="hint" style="color:var(--route)">Finding live hotel rates…</div>'
      : state==='error' ? `<div class="hint" style="color:var(--route)">Live rates unavailable — ${errMsg}.</div>
          <button class="btn ghost sm" id="rt">Retry</button>`
      : state==='off' ? '<div class="hint">Connect the worker (VITE_API_BASE) for live hotel rates.</div>'
      : filterRow+(hs.length?`<label class="minihead">Where you could stay — pan or zoom the map to search that area</label>
        <div class="optlist" style="max-height:150px">${hs.slice(0,8).map((h,j)=>`
          <div class="opt${trip.hotelPicks[s.city]?.name===h.name?' sel':''}" data-h="${j}">
            <span class="iata">$${Math.round(h.price/Math.max(s.nights,1))}</span>
            <span class="nm">${h.name}<div class="sub">${h.stars>0?`<span style="color:var(--gold)">${'★'.repeat(Math.min(h.stars,5))}</span>`:''}${h.rating!=null?` ${h.rating}/10`:''}${h.reviews?` · ${h.reviews.toLocaleString()} reviews`:''}</div></span>
          </div>`).join('')}</div>
        ${hidden>0?`<div class="hint">${hidden} more hidden by filters</div>`:''}`
        :`<div class="hint">${all.length?'Nothing matches these filters here — loosen one or move the map.':'No hotels in this area — pan or zoom the map to search elsewhere.'}</div>`);
    showCard(`
      <div class="eyebrow">City guide · ${i+1} of ${trip.stops.length}</div>
      <div class="question">${s.city}</div>
      <div class="hint">${s.nights} night${s.nights>1?'s':''} · ${fmtDate(ci)} → ${fmtDate(co)}${searching?' · <span style="color:var(--route)">searching this area…</span>':''}</div>
      ${hotelBlock}
      ${attractions.length?`<label class="minihead">Don't miss</label>
        <div class="attrlist">${attractions.slice(0,5).map(a=>`<div>· ${a}</div>`).join('')}</div>`:''}
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
    [['fStars','stars'],['fRating','rating'],['fBudget','budget']].forEach(([id,k])=>{
      const el=$('#'+id); if(el) el.onchange=()=>{ tourFilters[k]=+el.value; render(); pushPins(); };
    });
    const fg=$('#fGroup'); if(fg) fg.onchange=()=>{ tourFilters.group=fg.value; render(); pushPins(); };
    const rt=$('#rt'); if(rt) rt.onclick=()=>stepCityTour(i);
    $('#nx').onclick=()=>stepCityTour(i+1);
    $('#bk').onclick=()=>{ if(i===0){ gMarkers.selectAll('.hotelpin').remove(); hideDetailMap(); clearDots(); zoomToFeature(trip.dest.country).then(()=>stepItinerary()); } else stepCityTour(i-1); };
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
  showDetailMap(container,{ lat:s.lat, lon:s.lon, pins:[], attrs, nights:s.nights, fly:true });
  if(liveMode()) fetchArea(null);

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
      if(seq===tourSeq){ attrs=found; pushPins(); }
    })();
  }
}

/* ---- 7. end city (fly home from) ---- */
function stepEndCity(){
  ticket('stops',trip.stops.length,'return');
  clearDots();
  showCard(`
    <div class="eyebrow">Leg 03 — The way home</div>
    <div class="question">Where does your trip end?</div>
    <div class="hint">Choose the city you'll fly out of.</div>
    <div class="optlist">${trip.stops.map((s,i)=>`
      <div class="opt${i===trip.stops.length-1?' sel':''}" data-i="${i}"><span class="dot"></span>
        <span class="nm">${s.city}${i===trip.stops.length-1?'<div class="sub">Last stop — recommended</div>':''}</span></div>`).join('')}
    </div>
    <button class="backlink" id="bk">← adjust stops</button>`);
  qcard.querySelectorAll('.opt').forEach(o=>o.onclick=()=>{
    trip.endCity=trip.stops[+o.dataset.i];
    hideCard(); stepEndAirport();
  });
  $('#bk').onclick=()=>stepItinerary();
}

/* ---- 7b. departure airport for the flight home ---- */
function stepEndAirport(){
  const sCity=trip.endCity;
  const aps=sCity.airports&&sCity.airports.length?sCity.airports:null;
  function pick(a){ trip.endAirport=a; if(a) toast(`Return locked: departing ${a.iata} — ${sCity.city}`); hideCard(); clearDots(); stepHome(); }
  if(!aps){ trip.endAirport=null; return stepHome(); }
  if(aps.length===1) return pick(aps[0]);
  drawCityDots(aps.map(a=>({city:a.iata+' · '+shortName(a),lat:a.lat,lon:a.lon,large:a.large,_ap:a})),d=>pick(d._ap),12);
  showCard(`
    <div class="eyebrow">Leg 03 — The way home</div>
    <div class="question">Fly out of which airport?</div>
    <div class="hint">${sCity.city} — departure for the flight home.</div>
    <div class="optlist">${aps.map((a,i)=>`
      <div class="opt" data-i="${i}"><span class="iata">${a.iata}</span>
        <span class="nm">${a.name}<div class="sub">${a.large?'Major international':'Regional'}</div></span></div>`).join('')}
    </div>
    <button class="backlink" id="bk">← change end city</button>`);
  qcard.querySelectorAll('.opt').forEach(o=>o.onclick=()=>pick(aps[+o.dataset.i]));
  $('#bk').onclick=()=>stepEndCity();
}

/* ---- 8. fly home to ---- */
function stepHome(){
  const o=trip.origin;
  showCard(`
    <div class="eyebrow">Leg 03 — The way home</div>
    <div class="question">Where do you fly home to?</div>
    <div class="optlist">
      <div class="opt sel" id="optHome"><span class="iata">${o.airport.iata}</span>
        <span class="nm">${o.airport.name}<div class="sub">Back where you started · ${o.city.city}</div></span></div>
    </div>
    <div class="field"><label>…or somewhere else</label>
      <input type="text" id="inHome" placeholder="Search any airport (city, name, or code)" autocomplete="off">
      <div class="suggest" id="sgHome"></div>
    </div>
    <button class="backlink" id="bk">← change end city</button>`);
  const items=airports.map(a=>({a,_s:(a.iata+' '+a.city+' '+a.name).toLowerCase()}));
  attachTypeahead($('#inHome'),$('#sgHome'),items,
    it=>`<span>${it.a.city} — ${shortName(it.a)}</span><span class="code">${it.a.iata}</span>`,
    it=>pick(it.a));
  $('#optHome').onclick=()=>pick(o.airport);
  $('#bk').onclick=()=>stepEndAirport();
  const pick=a=>{
    trip.home=a;
    ticket('return',`${a.city} <span class="iata">${a.iata}</span>`);
    hideCard();
    stepSummary();
  };
}

/* ---- 9. summary + transport ---- */
function buildLegs(){
  const o=trip.origin, first=trip.stops[0];
  const legs=[];
  const arr=trip.dest.airport;
  legs.push({a:{lat:o.airport.lat,lon:o.airport.lon,name:o.city.city+' '+o.airport.iata},
             b:{lat:arr?.lat??first.lat,lon:arr?.lon??first.lon,name:arr?`${trip.dest.gwCity.city} ${arr.iata}`:first.city}, kind:'intl'});
  for(let i=0;i<trip.stops.length-1;i++)
    legs.push({a:{...trip.stops[i],name:trip.stops[i].city},b:{...trip.stops[i+1],name:trip.stops[i+1].city},kind:'inner'});
  const dep=trip.endAirport;
  legs.push({a:{lat:dep?.lat??trip.endCity.lat,lon:dep?.lon??trip.endCity.lon,name:dep?`${trip.endCity.city} ${dep.iata}`:trip.endCity.city},
             b:{lat:trip.home.lat,lon:trip.home.lon,name:trip.home.city+' '+trip.home.iata},kind:'intl'});
  legs.forEach(l=>l.km=Math.round(haversine(l.a,l.b)));
  return legs;
}
function stepSummary(){
  const legs=buildLegs();
  trip.legModes=legs.map((l,i)=>trip.legModes[i]||(l.kind==='intl'||l.km>900?'flight':(l.km>350?'train':'drive')));
  // fit whole route
  const pts=legs.flatMap(l=>[proj([l.a.lon,l.a.lat]),proj([l.b.lon,l.b.lat])]);
  const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);
  clearDots();
  drawStopBadges(trip.stops);
  drawHomeBadge({lat:trip.origin.airport.lat,lon:trip.origin.airport.lon},trip.origin.airport.iata);
  if(trip.home.iata!==trip.origin.airport.iata) drawHomeBadge({lat:trip.home.lat,lon:trip.home.lon},trip.home.iata);
  zoomToBounds([[d3.min(xs),d3.min(ys)],[d3.max(xs),d3.max(ys)]],0.22,DUR,Math.min(440,W*0.35)).then(()=>{
    drawArcs(legs.map((l,i)=>({...l,mode:trip.legModes[i]})));
    if(!RM) flyPlane(legs[0]);
  });
  ticket(null,null,null);
  setTimeout(()=>{
    showCard(`
      <div class="eyebrow">Final approach</div>
      <div class="question">Your route, plotted.</div>
      <div class="hint">${trip.origin.city.city} → ${trip.stops.map(s=>s.city).join(' → ')} → ${trip.home.city}
        · ${trip.nights} night${trip.nights>1?'s':''} · departs ${fmtDate(trip.date)}</div>
      <div class="row" style="margin-top:14px">
        <button class="btn red" id="doneBtn">Transport, flights &amp; points →</button>
        <button class="btn ghost sm" id="editBtn">Edit stops</button>
        <button class="btn ghost sm" id="restartBtn">Start over</button>
      </div>
      <div class="finenote">Next: live fares for your dates, verified award space, and the funding plan for every leg.</div>`);
    $('#doneBtn').onclick=()=>{
      onComplete && onComplete({
        date: trip.date,
        originCountry: nameOf(trip.origin.country),
        originCity: { name: trip.origin.city.city, lat: trip.origin.city.lat, lon: trip.origin.city.lon },
        originAirport: { iata: trip.origin.airport.iata, name: trip.origin.airport.name, lat: trip.origin.airport.lat, lon: trip.origin.airport.lon },
        destCountry: nameOf(trip.dest.country),
        arrivalCity: { name: trip.dest.gwCity.city, lat: trip.dest.gwCity.lat, lon: trip.dest.gwCity.lon },
        arrivalAirport: { iata: trip.dest.airport.iata, name: trip.dest.airport.name, lat: trip.dest.airport.lat, lon: trip.dest.airport.lon },
        endAirport: trip.endAirport ? { iata: trip.endAirport.iata, name: trip.endAirport.name, lat: trip.endAirport.lat, lon: trip.endAirport.lon } : null,
        hotelPicks: Object.fromEntries(Object.entries(trip.hotelPicks).filter(([, v]) => v)),
        hotelPrefs: { stars: tourFilters.stars, rating: tourFilters.rating, budget: tourFilters.budget, group: tourFilters.group },
        stops: trip.stops.map(s=>({ name: s.city, lat: s.lat, lon: s.lon, nights: s.nights, iata: s.airports?.[0]?.iata ?? null })),
        endCity: trip.endCity.city,
        homeAirport: { iata: trip.home.iata, name: trip.home.name, city: trip.home.city, lat: trip.home.lat, lon: trip.home.lon },
      });
    };
    $('#editBtn').onclick=()=>{ hideCard(); gArcs.selectAll('*').remove();
      gMarkers.selectAll('.homebadge').remove(); zoomToFeature(trip.dest.country).then(()=>stepItinerary()); };
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
$('#beginBtn').onclick=()=>{
  $('#intro').classList.add('hide');
  $('#ticket').classList.add('show');
  setTimeout(stepOriginCountry, RM?0:350);
};
return () => { destroyDetailMap(); container.innerHTML = ''; };
}
