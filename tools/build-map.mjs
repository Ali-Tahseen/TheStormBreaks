// Builds public/data/world-1939.json — the 1939 territory map.
// ------------------------------------------------------------------
// Source: Natural Earth 1:10m admin-1 (states/provinces), public domain.
// Modern provinces are grouped into 1939 territories (e.g. Kaliningrad +
// Warmian-Masurian + Klaipėda = East Prussia). Where a 1939 border cut
// through a modern province, the province is cut along an approximate
// historical line (the CLIPS below). Accuracy is roughly 10–30 km, which is
// fine at the scale this game is played.
//
// Run:  npm run build-map        (downloads ~40 MB the first time)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mapshaper from 'mapshaper';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE = path.join(__dirname, 'cache');
const SRC = path.join(CACHE, 'ne_10m_admin_1_states_provinces.geojson');
const OUT = path.join(__dirname, '..', 'public', 'data', 'world-1939.json');
const URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson';

// ---------- 1. whole modern countries -> 1939 territory name ----------
// (Anything not listed keeps its modern country name. null = drop.)
const BY_COUNTRY = {
  // Germany and annexations
  DEU: 'Germany', AUT: 'Austria', CZE: 'Bohemia and Moravia',
  // Italy
  ALB: 'Albania', LBY: 'Libya', ETH: 'Italian East Africa', ERI: 'Italian East Africa', SOM: 'Italian East Africa',
  VAT: 'Italy', SMR: 'Italy',
  // Japan
  KOR: 'Korea', PRK: 'Korea', TWN: 'Taiwan',
  MNP: 'South Seas Mandate', PLW: 'South Seas Mandate', FSM: 'South Seas Mandate', MHL: 'South Seas Mandate',
  // Soviet Union
  GEO: 'Transcaucasia', ARM: 'Transcaucasia', AZE: 'Transcaucasia',
  KAZ: 'Soviet Central Asia', UZB: 'Soviet Central Asia', TKM: 'Soviet Central Asia', KGZ: 'Soviet Central Asia', TJK: 'Soviet Central Asia', KAB: 'Soviet Central Asia',
  // British Empire
  GBR: 'United Kingdom', IMN: 'United Kingdom', GGY: 'United Kingdom', JEY: 'United Kingdom',
  GIB: 'Gibraltar', MLT: 'Malta', CYP: 'Cyprus', CYN: 'Cyprus', ESB: 'Cyprus', WSB: 'Cyprus',
  IND: 'British India', PAK: 'British India', BGD: 'British India', KAS: 'British India',
  MMR: 'Burma', LKA: 'Ceylon', MYS: 'Malaya', BRN: 'Malaya', SGP: 'Singapore', HKG: 'Hong Kong',
  ISR: 'Palestine', PSX: 'Palestine', JOR: 'Transjordan',
  KWT: 'Kuwait', QAT: 'Qatar', BHR: 'Bahrain', ARE: 'Trucial States', OMN: 'Muscat and Oman',
  EGY: 'Egypt', SDN: 'Anglo-Egyptian Sudan', SDS: 'Anglo-Egyptian Sudan', SOL: 'British Somaliland',
  KEN: 'Kenya', UGA: 'Uganda', TZA: 'Tanganyika', ZMB: 'Northern Rhodesia', ZWE: 'Southern Rhodesia',
  MWI: 'Nyasaland', BWA: 'Bechuanaland', LSO: 'Basutoland', SWZ: 'Swaziland',
  NGA: 'Nigeria', GHA: 'Gold Coast', SLE: 'Sierra Leone', GMB: 'Gambia',
  MUS: 'British Indian Ocean', SYC: 'British Indian Ocean', MDV: 'British Indian Ocean', IOT: 'British Indian Ocean', SHN: 'British Indian Ocean',
  BLZ: 'British Honduras', GUY: 'British Guiana', FLK: 'Falkland Islands', SGS: 'Falkland Islands',
  JAM: 'British West Indies', TTO: 'British West Indies', BHS: 'British West Indies', BRB: 'British West Indies',
  CYM: 'British West Indies', VGB: 'British West Indies', AIA: 'British West Indies', MSR: 'British West Indies',
  KNA: 'British West Indies', ATG: 'British West Indies', DMA: 'British West Indies', LCA: 'British West Indies',
  VCT: 'British West Indies', GRD: 'British West Indies', TCA: 'British West Indies', BMU: 'British West Indies',
  FJI: 'British Pacific Islands', SLB: 'British Pacific Islands', VUT: 'British Pacific Islands', TON: 'British Pacific Islands',
  KIR: 'British Pacific Islands', TUV: 'British Pacific Islands', PCN: 'British Pacific Islands',
  // Dominions
  AUS: 'Australia', PNG: 'New Guinea', NRU: 'New Guinea', NFK: 'Australia', IOA: 'Australia',
  NZL: 'New Zealand', WSM: 'New Zealand', COK: 'New Zealand', NIU: 'New Zealand',
  ZAF: 'South Africa', NAM: 'South West Africa',
  // French Empire
  FRA: 'France', MCO: 'France', AND: 'France',
  DZA: 'Algeria', TUN: 'Tunisia', MAR: 'French Morocco',
  SEN: 'French West Africa', MLI: 'French West Africa', MRT: 'French West Africa', GIN: 'French West Africa',
  CIV: 'French West Africa', BFA: 'French West Africa', NER: 'French West Africa', BEN: 'French West Africa',
  TCD: 'French Equatorial Africa', CAF: 'French Equatorial Africa', COG: 'French Equatorial Africa', GAB: 'French Equatorial Africa',
  CMR: 'French Cameroun', TGO: 'French Togoland', MDG: 'Madagascar', COM: 'Madagascar', DJI: 'French Somaliland',
  SYR: 'Syria and Lebanon', LBN: 'Syria and Lebanon', VNM: 'French Indochina', LAO: 'French Indochina', KHM: 'French Indochina',
  NCL: 'French Pacific Islands', PYF: 'French Pacific Islands', WLF: 'French Pacific Islands',
  SPM: 'French Antilles', BLM: 'French Antilles', MAF: 'French Antilles',
  // Other empires
  IDN: 'Dutch East Indies', SUR: 'Suriname', ABW: 'Dutch Caribbean', CUW: 'Dutch Caribbean', SXM: 'Dutch Caribbean',
  COD: 'Belgian Congo', RWA: 'Belgian Congo', BDI: 'Belgian Congo',
  AGO: 'Angola', MOZ: 'Mozambique', GNB: 'Portuguese Guinea', CPV: 'Portugal', STP: 'Angola', TLS: 'Portuguese Timor', MAC: 'Macau',
  SAH: 'Spanish Sahara', GNQ: 'Spanish Guinea',
  USA: 'United States', PHL: 'Philippines', PRI: 'Puerto Rico', VIR: 'Puerto Rico', GUM: 'Guam', ASM: 'US Pacific Islands', UMI: 'US Pacific Islands',
  GRL: 'Greenland', FRO: 'Denmark',
  // Europe
  SRB: 'Yugoslavia', HRV: 'Yugoslavia', SVN: 'Yugoslavia', BIH: 'Yugoslavia', MNE: 'Yugoslavia', MKD: 'Yugoslavia', KOS: 'Yugoslavia',
  ROU: 'Romania', BGR: 'Bulgaria', HUN: 'Hungary', SVK: 'Slovakia', LIE: 'Switzerland',
  ALD: 'Finland', FIN: 'Finland', LTU: 'Lithuania', POL: 'Poland',
  BLR: 'Soviet Belarus', UKR: 'Soviet Ukraine', MDA: 'Bessarabia and Bukovina',
  // Drop: uninhabited or disputed specks
  ATA: null, ATF: null, HMD: null, CLP: null, CSI: null, ATC: null, PGA: null, USG: null
};

// ---------- 2. province-level exceptions (country code : province name) ----------
const BY_PROVINCE = {
  // Poland 1939: German Pomerania/Silesia and East Prussia
  'POL:West Pomeranian': 'Germany', 'POL:Lubusz': 'Germany', 'POL:Lower Silesian': 'Germany', 'POL:Opole': 'Germany',
  'POL:Warmian-Masurian': 'East Prussia', 'RUS:Kaliningrad': 'East Prussia', 'LTU:Klaipedos': 'East Prussia',
  'LTU:Vilniaus': 'Eastern Poland',
  // Romania 1939 held Southern Dobruja, Bessarabia and Northern Bukovina
  'BGR:Dobrich': 'Romania', 'BGR:Silistra': 'Romania', 'UKR:Chernivtsi': 'Bessarabia and Bukovina',
  // East bank of the Dniester was the Soviet Moldavian ASSR
  'MDA:Transnistria': 'Soviet Ukraine', 'MDA:Stîngă Nistrului': 'Soviet Ukraine', 'MDA:Camenca': 'Soviet Ukraine', 'MDA:Grigoriopol': 'Soviet Ukraine',
  // Carpatho-Ukraine, occupied by Hungary in March 1939
  'UKR:Transcarpathia': 'Hungary',
  // Newfoundland was a separate dominion, governed from London since 1934
  'CAN:Newfoundland and Labrador': 'Newfoundland',
  'USA:Alaska': 'Alaska', 'USA:Hawaii': 'Hawaii',
  // Western Sahara provinces listed under Morocco
  'MAR:Laâyoune - Boujdour - Sakia El Hamra': 'Spanish Sahara', 'MAR:Oued el Dahab': 'Spanish Sahara',
  // Dutch Caribbean islands listed under the Netherlands
  'NLD:Bonaire': 'Dutch Caribbean', 'NLD:St. Eustatius': 'Dutch Caribbean', 'NLD:Saba': 'Dutch Caribbean'
};

// Region-based splits for big countries
function byRegion(a3, p) {
  if (a3 === 'RUS') {
    if (p.region === 'Far Eastern') return 'Soviet Far East';
    if (p.region === 'Siberian' || p.region === 'Urals') return 'Urals and Siberia';
    return 'European Russia';
  }
  if (a3 === 'CHN') {
    const n = p.name;
    if (['Heilongjiang', 'Jilin', 'Liaoning'].includes(n)) return 'Manchukuo';
    if (['Beijing', 'Tianjin', 'Hebei', 'Shanxi', 'Shandong', 'Henan'].includes(n)) return 'North China';
    if (['Jiangsu', 'Shanghai', 'Zhejiang', 'Anhui', 'Jiangxi', 'Fujian'].includes(n)) return 'East China';
    if (['Hubei', 'Hunan'].includes(n)) return 'Central China';
    if (['Guangdong', 'Guangxi', 'Hainan', 'Paracel Islands'].includes(n)) return 'South China';
    if (['Sichuan', 'Chongqing', 'Yunnan', 'Guizhou'].includes(n)) return 'Southwest China';
    if (['Shaanxi', 'Gansu', 'Ningxia', 'Qinghai'].includes(n)) return 'Northwest China';
    if (n === 'Inner Mongol') return 'Inner Mongolia';
    if (n === 'Xinjiang') return 'Xinjiang';
    if (n === 'Xizang') return 'Tibet';
    return 'Southwest China';
  }
  if (a3 === 'FRA') {
    if (p.region === 'Guyane française') return 'French Guiana';
    if (p.region === 'Guadeloupe' || p.region === 'Martinique') return 'French Antilles';
    if (p.region === 'Réunion' || p.region === 'Mayotte') return 'Madagascar';
  }
  return undefined;
}

// ---------- 3. cuts along approximate 1939 border lines ----------
// Each clip takes the provinces in `members`, cuts them with `polygon`
// ([lon, lat] ring). The part INSIDE becomes `inside`; the rest keeps its name.
const CLIPS = [
  { id: 'kresy', inside: 'Eastern Poland',
    note: 'Polish–Soviet border of the 1921 Treaty of Riga',
    members: (a3, p) => a3 === 'BLR' || (a3 === 'UKR' && !['Transcarpathia', 'Chernivtsi', 'Odessa'].includes(p.name)),
    polygon: [[20, 56.5], [27.4, 56.3], [27.8, 55.85], [28.3, 55.6], [28.45, 55.35], [28.1, 55.05], [27.55, 54.85], [27.2, 54.5],
      [27.05, 54.1], [27.1, 53.8], [27.25, 53.5], [27.4, 53.1], [27.6, 52.7], [27.75, 52.3], [27.6, 51.9], [27.35, 51.4],
      [27.2, 50.95], [27.15, 50.6], [26.7, 50.35], [26.35, 50.05], [26.2, 49.5], [26.1, 49.0], [26.25, 48.5], [26.25, 47.5], [20, 47.5], [20, 56.5]] },
  { id: 'budjak', inside: 'Bessarabia and Bukovina',
    note: 'Southern Bessarabia (Budjak), Romanian until 1940',
    members: (a3, p) => a3 === 'UKR' && p.name === 'Odessa',
    polygon: [[28, 45.1], [30.8, 45.1], [30.4, 46.1], [29.95, 46.4], [29.6, 46.8], [28, 46.8], [28, 45.1]] },
  { id: 'karelia', inside: 'Finland',
    note: 'Karelian Isthmus and Ladoga Karelia, Finnish until 1940',
    members: (a3, p) => a3 === 'RUS' && ['Leningrad', 'Karelia', 'City of St. Petersburg'].includes(p.name),
    polygon: [[27, 60.2], [29.97, 60.17], [30.05, 60.35], [30.45, 60.55], [30.85, 60.72], [31.87, 61.35], [31.55, 61.7],
      [31.45, 62.2], [31.6, 63.0], [27, 63.0], [27, 60.2]] },
  { id: 'petsamo', inside: 'Finland',
    note: 'Petsamo corridor to the Arctic, Finnish until 1944',
    members: (a3, p) => a3 === 'RUS' && p.name === 'Murmansk',
    polygon: [[28.5, 68.9], [30.3, 68.7], [31.2, 69.0], [31.9, 69.4], [32.3, 69.75], [32.4, 69.95], [29.5, 70.2], [28.5, 69.9], [28.5, 68.9]] },
  { id: 'sakhalin', inside: 'Karafuto',
    note: 'Japanese South Sakhalin (south of 50°N) and the Kuril Islands',
    members: (a3, p) => a3 === 'RUS' && p.name === 'Sakhalin',
    polygon: [[140, 43], [160, 43], [160, 50], [140, 50], [140, 43]] },
  { id: 'danzig', inside: 'Danzig',
    note: 'Free City of Danzig, annexed by Germany on 1 September 1939',
    members: (a3, p) => a3 === 'POL' && p.name === 'Pomeranian',
    polygon: [[18.53, 54.47], [18.62, 54.47], [19.0, 54.42], [19.65, 54.46], [19.38, 54.25], [19.2, 54.1], [18.95, 54.03],
      [18.7, 54.1], [18.5, 54.25], [18.45, 54.37], [18.53, 54.47]] },
  { id: 'slovakia', inside: 'Hungary',
    note: 'Southern Slovakia, given to Hungary by the First Vienna Award (November 1938)',
    members: (a3) => a3 === 'SVK',
    polygon: [[17.2, 47.6], [17.35, 48.02], [17.8, 48.12], [18.3, 48.22], [18.8, 48.3], [19.3, 48.3], [19.8, 48.42], [20.2, 48.5],
      [20.6, 48.72], [21.1, 48.8], [21.4, 48.8], [22.0, 48.7], [22.2, 48.6], [22.6, 48.3], [22.6, 47.6], [17.2, 47.6]] },
  { id: 'julian', inside: 'Italy',
    note: 'Julian March, Istria and Fiume — Italian between the wars',
    members: (a3, p) => a3 === 'SVN' || (a3 === 'HRV' && ['Istarska', 'Primorsko-Goranska'].includes(p.name)),
    polygon: [[13.3, 46.6], [13.72, 46.53], [13.85, 46.35], [14.05, 46.1], [14.2, 45.85], [14.35, 45.6], [14.45, 45.35], [14.6, 45.2],
      [14.3, 44.6], [13.4, 44.6], [13.2, 45.6], [13.3, 46.6]] },
  { id: 'spmorocco', inside: 'Spanish Morocco',
    note: 'Spanish protectorate zone in northern Morocco (with Tangier)',
    members: (a3, p) => a3 === 'MAR' && ['Tanger - Tétouan', 'Taza - Al Hoceima - Taounate', 'Oriental', 'Gharb - Chrarda - Béni Hssen'].includes(p.name),
    polygon: [[-6.4, 36.1], [-2.2, 35.5], [-2.3, 35.05], [-3.2, 34.9], [-4.2, 34.85], [-5.2, 34.95], [-5.95, 35.0], [-6.4, 35.05], [-6.4, 36.1]] }
];

// ---------- build ----------
async function main() {
  if (!fs.existsSync(SRC)) {
    fs.mkdirSync(CACHE, { recursive: true });
    console.log('Downloading Natural Earth admin-1 provinces (~40 MB)…');
    const res = await fetch(URL);
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    fs.writeFileSync(SRC, Buffer.from(await res.arrayBuffer()));
  }
  const src = JSON.parse(fs.readFileSync(SRC, 'utf8'));

  const features = [];
  let dropped = 0;
  for (const f of src.features) {
    const p = f.properties;
    const a3 = p.adm0_a3;
    let t = BY_PROVINCE[`${a3}:${p.name}`];
    if (t === undefined) t = byRegion(a3, p);
    if (t === undefined) t = a3 in BY_COUNTRY ? BY_COUNTRY[a3] : p.admin;
    if (t === null) { dropped++; continue; }
    const clip = CLIPS.find(c => c.members(a3, p));
    features.push({ type: 'Feature', geometry: f.geometry, properties: { t, clip: clip ? clip.id : '' } });
  }
  console.log(`${features.length} provinces grouped (${dropped} dropped)`);

  const files = { 'provinces.json': JSON.stringify({ type: 'FeatureCollection', features }) };
  const cmds = [];
  for (const c of CLIPS) {
    const poly = { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [c.polygon] } };
    files[`${c.id}_poly.json`] = JSON.stringify({ type: 'FeatureCollection', features: [poly] });
  }
  // All inputs in one dataset so shapes share borders; each file becomes a layer.
  cmds.push(`-i provinces.json ${CLIPS.map(c => `${c.id}_poly.json`).join(' ')} combine-files`, '-rename-layers base target=provinces');
  // Split each clip group into its own layer, cut it, and label the inside part.
  const clipCmds = [];
  for (const c of CLIPS) {
    clipCmds.push(
      `-filter 'clip=="${c.id}"' target=base + name=${c.id}`,
      `-clip ${c.id}_poly target=${c.id} + name=${c.id}_in`,
      `-each 't="${c.inside}"' target=${c.id}_in`,
      `-erase ${c.id}_poly target=${c.id}`
    );
  }
  const layers = ['base', ...CLIPS.flatMap(c => [c.id, `${c.id}_in`])].join(',');
  const cmd = [
    ...cmds,
    ...clipCmds,
    `-filter 'clip==""' target=base`,
    `-merge-layers target=${layers} force name=all`,
    '-dissolve t target=all',
    '-rename-fields name=t target=all',
    '-simplify 4% keep-shapes target=all',
    '-filter-slivers min-area=20km2 target=all',
    '-rename-layers territories target=all',
    '-o world-1939.json format=topojson quantization=1e5 target=territories'
  ].join(' ');

  const out = await mapshaper.applyCommands(cmd, files);
  const json = out['world-1939.json'];
  fs.writeFileSync(OUT, json);
  const topo = JSON.parse(json);
  const names = topo.objects.territories.geometries.map(g => g.properties.name).sort();
  console.log(`Wrote ${path.relative(process.cwd(), OUT)}: ${names.length} territories, ${(json.length / 1024).toFixed(0)} KB`);
  if (process.argv.includes('--list')) console.log(names.join('\n'));
}

main().catch(err => { console.error(err); process.exit(1); });
