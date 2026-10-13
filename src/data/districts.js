/**
 * Nicer districts — hand-curated for popular cities: the neighborhoods
 * known for upscale hotels, shopping and dining, with what each is known
 * for. Circles are approximate (center + radius in meters); the city tour
 * shades them and, with live rates loaded, adds the typical nightly price.
 * Cities not listed here fall back to price shading from live hotel rates.
 */
const D = (name, lat, lon, r, known) => ({ name, lat, lon, r, known });

export const DISTRICTS = {
  tokyo: [
    D("Ginza", 35.6717, 139.765, 700, "Flagship luxury shopping, department stores, sushi counters"),
    D("Marunouchi", 35.6812, 139.7640, 650, "Palace-side grand hotels, Tokyo Station, business district"),
    D("Roppongi & Azabu", 35.6627, 139.7313, 800, "Roppongi Hills, Tokyo Midtown, art museums, nightlife"),
    D("Omotesando & Aoyama", 35.6652, 139.7123, 750, "Designer flagships, cafés, tree-lined avenues"),
    D("Ebisu & Daikanyama", 35.6487, 139.7031, 700, "Quieter dining streets, boutiques, wine bars"),
  ],
  kyoto: [
    D("Gion & Higashiyama", 35.0010, 135.7790, 750, "Historic teahouse lanes, temples, ryokan"),
    D("Pontocho & Kawaramachi", 35.0050, 135.7704, 550, "Riverside dining, central shopping"),
    D("Arashiyama", 35.0094, 135.6768, 900, "Bamboo grove, river views, luxury ryokan"),
    D("Okazaki", 35.0157, 135.7823, 600, "Museums, Heian Shrine, calm canal-side stays"),
  ],
  osaka: [
    D("Umeda (Kita)", 34.7025, 135.4959, 800, "Luxury hotels above the stations, department stores"),
    D("Nakanoshima", 34.6935, 135.4930, 600, "River island, museums, refined dining"),
    D("Shinsaibashi & Namba", 34.6720, 135.5010, 800, "Shopping arcades, Dotonbori food scene"),
  ],
  seoul: [
    D("Cheongdam & Apgujeong", 37.5250, 127.0476, 900, "Luxury boutiques, K-fashion, fine dining"),
    D("Jongno & Gwanghwamun", 37.5720, 126.9768, 800, "Palaces, Bukchon hanok village, culture"),
    D("Hannam & Itaewon", 37.5345, 127.0010, 700, "Galleries, international dining, design shops"),
    D("Myeongdong", 37.5636, 126.9850, 500, "Shopping streets, beauty, street food"),
  ],
  "hong kong": [
    D("Central", 22.2819, 114.1582, 700, "Harbourfront hotels, Landmark luxury mall, dining"),
    D("Tsim Sha Tsui", 22.2973, 114.1722, 700, "Harbour views, Canton Road boutiques, museums"),
    D("Causeway Bay", 22.2802, 114.1830, 600, "Department stores, shopping malls"),
  ],
  singapore: [
    D("Marina Bay", 1.2834, 103.8607, 900, "Skyline hotels, Gardens by the Bay, waterfront"),
    D("Orchard Road", 1.3048, 103.8318, 900, "Luxury malls and the city's main shopping belt"),
    D("Sentosa", 1.2494, 103.8303, 1200, "Resort hotels, beaches, attractions"),
    D("Tanjong Pagar & Chinatown", 1.2795, 103.8443, 650, "Boutique hotels, cocktail bars, hawker food"),
  ],
  bangkok: [
    D("Riverside", 13.7230, 100.5140, 800, "Grand river hotels, boat access to the temples"),
    D("Ploenchit & Chidlom", 13.7440, 100.5470, 700, "Luxury malls, embassies, skytrain hub"),
    D("Sukhumvit & Thonglor", 13.7317, 100.5830, 900, "Restaurants, rooftop bars, nightlife"),
    D("Silom & Sathorn", 13.7240, 100.5300, 800, "Business hotels, Lumphini Park, dining"),
  ],
  dubai: [
    D("Downtown", 25.1972, 55.2744, 1100, "Burj Khalifa, Dubai Mall, fountain views"),
    D("Dubai Marina", 25.0805, 55.1403, 1100, "Waterfront towers, beach clubs, dining"),
    D("Palm Jumeirah", 25.1124, 55.1390, 1800, "Beach resorts on the Palm"),
  ],
  istanbul: [
    D("Sultanahmet", 41.0054, 28.9768, 700, "Hagia Sophia, Blue Mosque, Topkapı"),
    D("Galata & Karaköy", 41.0256, 28.9744, 650, "Boutique hotels, galleries, Bosphorus views"),
    D("Nişantaşı", 41.0480, 28.9934, 600, "Designer boutiques, chic cafés"),
    D("Bebek", 41.0770, 29.0430, 700, "Bosphorus waterfront, upscale dining"),
  ],
  london: [
    D("Mayfair", 51.5100, -0.1470, 650, "Grand hotels, Bond Street, private clubs"),
    D("Knightsbridge", 51.5010, -0.1609, 650, "Harrods, luxury boutiques, Hyde Park"),
    D("Chelsea", 51.4875, -0.1687, 750, "King's Road, garden squares, restaurants"),
    D("Marylebone", 51.5186, -0.1499, 600, "Village feel, food shops, boutiques"),
    D("Covent Garden", 51.5117, -0.1240, 550, "Theatres, shopping, dining"),
  ],
  paris: [
    D("Golden Triangle (8e)", 48.8686, 2.3030, 700, "Avenue Montaigne couture, palace hotels"),
    D("Place Vendôme & Tuileries", 48.8675, 2.3294, 550, "Jewellers, palace hotels, the Louvre"),
    D("Saint-Germain-des-Prés", 48.8540, 2.3330, 650, "Left Bank cafés, galleries, boutiques"),
    D("Le Marais", 48.8590, 2.3620, 700, "Historic mansions, designers, museums"),
    D("7e — Eiffel & Invalides", 48.8566, 2.3125, 800, "Quiet elegance near the Eiffel Tower"),
  ],
  rome: [
    D("Spanish Steps & Via Condotti", 41.9058, 12.4823, 550, "Luxury boutiques, grand hotels"),
    D("Navona & Pantheon", 41.8992, 12.4731, 600, "Historic center, piazzas, trattorias"),
    D("Trastevere", 41.8897, 12.4697, 600, "Cobbled lanes, dining, nightlife"),
    D("Parioli & Villa Borghese", 41.9180, 12.4920, 800, "Leafy residential, the Borghese Gallery"),
  ],
  florence: [
    D("Duomo & Tornabuoni", 43.7718, 11.2537, 550, "Cathedral, Via de' Tornabuoni fashion houses"),
    D("Oltrarno", 43.7660, 11.2500, 650, "Artisans, Pitti Palace, wine bars"),
  ],
  venice: [
    D("San Marco", 45.4342, 12.3388, 450, "St Mark's Square, grand canal palazzo hotels"),
    D("Dorsoduro", 45.4310, 12.3270, 550, "Galleries, quieter canals, the Zattere"),
  ],
  milan: [
    D("Quadrilatero della Moda", 45.4686, 9.1957, 450, "Via Montenapoleone flagships, luxury hotels"),
    D("Brera", 45.4719, 9.1873, 500, "Art district, boutiques, aperitivo bars"),
    D("Duomo", 45.4642, 9.1900, 500, "Cathedral, Galleria Vittorio Emanuele II"),
  ],
  barcelona: [
    D("Passeig de Gràcia & Eixample", 41.3925, 2.1650, 800, "Gaudí, luxury boutiques, modernist hotels"),
    D("Gothic Quarter", 41.3830, 2.1760, 500, "Medieval lanes, cathedral, tapas"),
    D("El Born", 41.3851, 2.1820, 450, "Picasso Museum, design shops, cocktail bars"),
  ],
  madrid: [
    D("Salamanca", 40.4300, -3.6800, 800, "Calle Serrano luxury shopping, fine dining"),
    D("Retiro & Jerónimos", 40.4140, -3.6880, 600, "The Prado, Retiro Park, grand hotels"),
    D("Sol & Las Letras", 40.4150, -3.6990, 600, "Historic center, tapas bars, theatres"),
  ],
  lisbon: [
    D("Chiado", 38.7105, -9.1420, 450, "Elegant shopping, cafés, theatres"),
    D("Príncipe Real", 38.7170, -9.1500, 450, "Concept stores, gardens, boutique hotels"),
    D("Avenida da Liberdade", 38.7200, -9.1450, 650, "Luxury avenue, five-star hotels"),
    D("Alfama", 38.7110, -9.1300, 500, "Old town lanes, fado, viewpoints"),
  ],
  amsterdam: [
    D("Canal Ring", 52.3680, 4.8880, 800, "UNESCO canals, boutique hotels, Nine Streets"),
    D("Museum Quarter", 52.3580, 4.8800, 650, "Rijksmuseum, P.C. Hooftstraat luxury shopping"),
    D("Jordaan", 52.3740, 4.8820, 550, "Galleries, cafés, markets"),
  ],
  berlin: [
    D("Mitte", 52.5200, 13.4050, 1100, "Museum Island, galleries, design hotels"),
    D("Charlottenburg & Ku'damm", 52.5040, 13.3200, 900, "Kurfürstendamm shopping, KaDeWe"),
    D("Prenzlauer Berg", 52.5390, 13.4240, 800, "Leafy squares, cafés, boutiques"),
  ],
  munich: [
    D("Altstadt & Maximilianstrasse", 48.1390, 11.5800, 700, "Luxury shopping, opera, grand hotels"),
    D("Schwabing", 48.1600, 11.5860, 800, "English Garden, cafés, galleries"),
  ],
  vienna: [
    D("Innere Stadt", 48.2082, 16.3738, 900, "Ringstrasse palaces, opera, coffee houses"),
    D("Neubau & Spittelberg", 48.2010, 16.3500, 650, "MuseumsQuartier, design shops"),
  ],
  prague: [
    D("Old Town", 50.0870, 14.4210, 600, "Old Town Square, Pařížská luxury street"),
    D("Malá Strana", 50.0880, 14.4040, 550, "Baroque lanes below the castle"),
    D("Vinohrady", 50.0750, 14.4430, 800, "Leafy residential, cafés, wine bars"),
  ],
  zurich: [
    D("Altstadt & Bahnhofstrasse", 47.3720, 8.5390, 650, "Luxury shopping street, old town"),
    D("Seefeld", 47.3560, 8.5550, 650, "Lakeside promenade, upscale dining"),
  ],
  copenhagen: [
    D("Indre By", 55.6790, 12.5800, 750, "Strøget shopping, palaces, Michelin dining"),
    D("Nyhavn & Frederiksstaden", 55.6840, 12.5900, 550, "Harbour, Amalienborg, grand hotels"),
    D("Vesterbro", 55.6680, 12.5500, 700, "Meatpacking district dining, bars"),
  ],
  stockholm: [
    D("Östermalm", 59.3380, 18.0800, 800, "Luxury boutiques, food hall, waterfront"),
    D("Gamla Stan", 59.3250, 18.0710, 450, "Medieval old town, Royal Palace"),
    D("Södermalm", 59.3150, 18.0700, 900, "Vintage shops, views, cafés"),
  ],
  athens: [
    D("Kolonaki", 37.9790, 23.7420, 550, "Chic boutiques, cafés, museums"),
    D("Plaka & Acropolis", 37.9720, 23.7300, 600, "Old town lanes below the Acropolis"),
    D("Syntagma", 37.9755, 23.7348, 450, "Grand hotels, parliament, shopping"),
  ],
  "new york": [
    D("Upper East Side", 40.7736, -73.9566, 1000, "Museum Mile, Madison Avenue, classic hotels"),
    D("Midtown & Fifth Avenue", 40.7590, -73.9765, 800, "Flagships, Central Park South, Rockefeller"),
    D("SoHo", 40.7233, -74.0030, 600, "Boutiques, galleries, loft hotels"),
    D("Tribeca", 40.7163, -74.0086, 600, "Quiet luxury, restaurants, celebrities"),
    D("West Village", 40.7358, -74.0036, 650, "Brownstone streets, dining, bars"),
  ],
  "los angeles": [
    D("Beverly Hills", 34.0736, -118.4004, 1300, "Rodeo Drive, iconic luxury hotels"),
    D("Santa Monica", 34.0195, -118.4912, 1200, "Beach hotels, pier, Third Street"),
    D("West Hollywood", 34.0900, -118.3617, 1100, "Sunset Strip, design hotels, dining"),
  ],
  "san francisco": [
    D("Union Square & Nob Hill", 37.7920, -122.4150, 700, "Grand hotels, shopping, cable cars"),
    D("Pacific Heights", 37.7925, -122.4382, 800, "Victorian mansions, Fillmore Street"),
    D("Embarcadero", 37.7955, -122.3937, 700, "Ferry Building, bay views"),
  ],
  miami: [
    D("South Beach", 25.7826, -80.1341, 1100, "Art Deco hotels, Ocean Drive, nightlife"),
    D("Brickell", 25.7617, -80.1918, 800, "Skyline hotels, dining, bay views"),
    D("Bal Harbour", 25.8909, -80.1270, 800, "Luxury mall and beach resorts"),
  ],
  chicago: [
    D("Gold Coast & Magnificent Mile", 41.9030, -87.6280, 800, "Luxury shopping, lakefront hotels"),
    D("River North", 41.8920, -87.6340, 700, "Galleries, steakhouses, nightlife"),
  ],
  toronto: [
    D("Yorkville", 43.6710, -79.3930, 600, "Luxury boutiques, galleries, fine dining"),
    D("Financial District & Harbourfront", 43.6440, -79.3810, 800, "Business hotels, lake, CN Tower"),
  ],
  "mexico city": [
    D("Polanco", 19.4330, -99.1950, 1000, "Luxury hotels, Masaryk Avenue, top restaurants"),
    D("Roma & Condesa", 19.4140, -99.1690, 1000, "Art deco streets, cafés, parks"),
    D("Centro Histórico", 19.4326, -99.1332, 700, "Zócalo, palaces, museums"),
  ],
  sydney: [
    D("The Rocks & Circular Quay", -33.8600, 151.2090, 650, "Harbour Bridge and Opera House views"),
    D("Double Bay", -33.8780, 151.2420, 600, "Boutiques, cafés, harbourside villas"),
    D("Bondi", -33.8915, 151.2767, 900, "Beach, coastal walk, dining"),
  ],
  melbourne: [
    D("CBD laneways", -37.8136, 144.9631, 900, "Laneway dining, arcades, galleries"),
    D("South Yarra & Toorak", -37.8390, 144.9930, 900, "Chapel Street, boutiques, leafy streets"),
    D("Southbank", -37.8230, 144.9650, 700, "Arts precinct, river views"),
  ],
  "rio de janeiro": [
    D("Ipanema", -22.9840, -43.2050, 900, "Beachfront hotels, boutiques"),
    D("Leblon", -22.9840, -43.2230, 800, "Upscale dining, quiet beach"),
    D("Copacabana", -22.9711, -43.1822, 1100, "Iconic beach and grand hotels"),
  ],
  "buenos aires": [
    D("Recoleta", -34.5875, -58.3974, 800, "Belle Époque mansions, Alvear Avenue"),
    D("Palermo", -34.5800, -58.4250, 1300, "Parks, design shops, restaurants"),
    D("Puerto Madero", -34.6110, -58.3630, 900, "Docklands hotels, steakhouses"),
  ],
  honolulu: [D("Waikiki", 21.2793, -157.8292, 1300, "Beach resorts, shopping, Diamond Head")],
  cancun: [D("Hotel Zone", 21.1350, -86.7480, 3000, "Beach resorts on the lagoon strip")],
  edinburgh: [
    D("New Town", 55.9540, -3.1960, 700, "Georgian streets, George Street shopping"),
    D("Old Town", 55.9490, -3.1910, 600, "Royal Mile, castle, closes and wynds"),
  ],
  dublin: [
    D("Georgian Quarter", 53.3380, -6.2540, 700, "St Stephen's Green, Merrion Square, grand hotels"),
    D("Temple Bar", 53.3455, -6.2650, 400, "Pubs, culture, nightlife"),
  ],
  nice: [
    D("Carré d'Or & Promenade", 43.6950, 7.2650, 650, "Seafront palaces, boutiques"),
    D("Vieux Nice", 43.6970, 7.2760, 450, "Old town lanes, markets"),
  ],
  santorini: [
    D("Oia", 36.4618, 25.3753, 900, "Caldera sunsets, cave suites"),
    D("Imerovigli", 36.4320, 25.4230, 700, "Cliff-top suites, quiet caldera views"),
    D("Fira", 36.4167, 25.4318, 700, "Caldera town, dining, shopping"),
  ],
  bali: [
    D("Seminyak", -8.6910, 115.1680, 1200, "Beach clubs, villas, dining"),
    D("Ubud", -8.5069, 115.2625, 1500, "Jungle resorts, rice terraces, culture"),
    D("Nusa Dua", -8.8010, 115.2310, 1800, "Gated beach resorts"),
  ],
  marrakech: [
    D("Medina", 31.6295, -7.9811, 900, "Riads, souks, Jemaa el-Fnaa"),
    D("Hivernage", 31.6220, -8.0130, 700, "Luxury hotels, gardens, nightlife"),
  ],
};

const kmBetween = (a, b) => {
  const R = 6371, rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

/** Curated districts near a point — by distance, so any spelling of the
 *  city (or a nearby town) finds them. */
export function districtsNear(lat, lon, maxKm = 30) {
  const out = [];
  for (const [city, list] of Object.entries(DISTRICTS)) {
    for (const d of list) if (kmBetween({ lat, lon }, d) <= maxKm) out.push({ ...d, city });
  }
  return out;
}

/** A district as a GeoJSON polygon (64-gon circle) for map shading. */
export function districtPolygon(d) {
  const pts = [];
  const dLat = d.r / 111320, dLon = d.r / (111320 * Math.cos((d.lat * Math.PI) / 180));
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * 2 * Math.PI;
    pts.push([d.lon + dLon * Math.cos(a), d.lat + dLat * Math.sin(a)]);
  }
  return { type: "Feature", properties: { name: d.name }, geometry: { type: "Polygon", coordinates: [pts] } };
}

/** Is a point inside a district circle? */
export const inDistrict = (p, d) => kmBetween(p, d) * 1000 <= d.r;
