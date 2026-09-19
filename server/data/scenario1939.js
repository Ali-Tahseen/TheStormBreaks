// Scenario: "The Storm Breaks" — 1 September 1939
// ------------------------------------------------------------------
// Everything that defines a scenario lives in this file, so a new
// scenario (e.g. "Chinese Civil War 1945") is a new data file, not new code.
//
// Territory keys are the names in public/data/world-1939.json, a 1939 map
// built by tools/build-map.mjs. Any territory NOT listed in TERRITORY_OWNERS
// becomes its own minor nation automatically.

export const SCENARIO = {
  id: 'ww2-1939',
  title: 'The Storm Breaks',
  startDate: { year: 1939, month: 9 },   // month is 1-12
  endDate: { year: 1945, month: 9 },
  briefing: [
    {
      heading: 'The peace that failed',
      text: 'The Treaty of Versailles (1919) blamed Germany for the First World War, took away territory, limited its army and demanded reparations. Many Germans felt humiliated, and politicians who promised to overturn the treaty found an audience.'
    },
    {
      heading: 'Depression and dictators',
      text: 'The Great Depression after 1929 threw millions out of work. In Germany, Adolf Hitler and the Nazi Party came to power in 1933 and built a dictatorship. Italy under Mussolini and militarist leaders in Japan also chose expansion abroad.'
    },
    {
      heading: 'Expansion and appeasement',
      text: 'Japan seized Manchuria in 1931 and went to full war with China in 1937. Italy invaded Ethiopia in 1935. Germany remilitarised the Rhineland (1936), absorbed Austria (1938) and, after the Munich Agreement, took the Sudetenland and then the rest of Czech lands (March 1939). Britain and France tried to avoid war by giving in to demands — a policy called appeasement.'
    },
    {
      heading: 'August 1939: the shock pact',
      text: 'On 23 August 1939 Nazi Germany and the Soviet Union, bitter ideological enemies, signed the Molotov–Ribbentrop Pact. Publicly it promised non-aggression; secretly it divided Eastern Europe between them. Britain and France had promised to defend Poland.'
    },
    {
      heading: 'Today: 1 September 1939',
      text: 'German forces have crossed into Poland. The world is waiting to see what Britain, France, the Soviet Union and the United States will do. Now it is your turn to lead.'
    }
  ]
};

// Indicator definitions — the UI tabs are generated from this list.
export const INDICATORS = {
  gdp:         { label: 'GDP',            tab: 'economy',  min: 0, max: 5000, unit: 'bn $', help: 'Size of the economy (billions, 1990 international dollars — approximate historical estimates).' },
  industry:    { label: 'Industry',       tab: 'economy',  min: 0, max: 100,  unit: '',     help: 'Factory output available for weapons and goods.' },
  resources:   { label: 'Resources',      tab: 'economy',  min: 0, max: 100,  unit: '',     help: 'Access to oil, steel, rubber and food.' },
  army:        { label: 'Army',           tab: 'military', min: 0, max: 100,  unit: '',     help: 'Strength and readiness of land forces.' },
  navy:        { label: 'Navy',           tab: 'military', min: 0, max: 100,  unit: '',     help: 'Strength of the fleet.' },
  air:         { label: 'Air',      tab: 'military', min: 0, max: 100,  unit: '',     help: 'Strength of the air force.' },
  manpower:    { label: 'Manpower',       tab: 'military', min: 0, max: 60,   unit: 'm',    help: 'Millions of people who could be mobilised.' },
  stability:   { label: 'Stability',      tab: 'politics', min: 0, max: 100,  unit: '',     help: 'How firmly the government holds power. At 0 the government collapses.' },
  war_support: { label: 'War support',    tab: 'politics', min: 0, max: 100,  unit: '',     help: 'How willing the population is to fight.' }
};

export const FACTIONS = {
  Allies:    { color: '#2f5d8a', help: 'Britain, France and their partners, pledged to defend Poland.' },
  Axis:      { color: '#3b3b3b', help: 'Germany, Italy and Japan (Anti-Comintern Pact; formal Tripartite Pact came in 1940).' },
  Comintern: { color: '#8a1c1c', help: 'The Soviet Union and states aligned with it.' }
};

const ind = (gdp, industry, resources, army, navy, air, manpower, stability, war_support) =>
  ({ gdp, industry, resources, army, navy, air, manpower, stability, war_support });

// Major and important minor nations. Colors echo classic atlas conventions
// (e.g. the British Empire in pink). Numbers are simplified game values.
export const NATIONS = {
  GER: { name: 'Germany',        leader: 'Adolf Hitler',           ideology: 'Nazi dictatorship',        faction: 'Axis',      color: '#6e7479', home: 'Germany',                  playable: true,  indicators: ind(412, 85, 40, 85, 35, 80, 10, 75, 60) },
  ITA: { name: 'Italy',          leader: 'Benito Mussolini',       ideology: 'Fascist dictatorship',     faction: 'Axis',      color: '#5f8a3a', home: 'Italy',                    playable: true,  indicators: ind(151, 45, 25, 45, 55, 45, 5, 60, 35) },
  JAP: { name: 'Japan',          leader: 'Nobuyuki Abe (Prime Minister)', ideology: 'Militarist empire', faction: 'Axis',      color: '#d9b44a', home: 'Japan',                    playable: true,  indicators: ind(196, 55, 20, 60, 80, 60, 7, 70, 70) },
  UK:  { name: 'United Kingdom', leader: 'Neville Chamberlain',    ideology: 'Parliamentary democracy',  faction: 'Allies',    color: '#d98c9a', home: 'United Kingdom',           playable: true,  indicators: ind(287, 70, 60, 35, 95, 60, 6, 80, 55) },
  FRA: { name: 'France',         leader: 'Édouard Daladier',       ideology: 'Parliamentary democracy',  faction: 'Allies',    color: '#4f7cc4', home: 'France',                   playable: true,  indicators: ind(199, 55, 45, 70, 60, 40, 6, 55, 40) },
  USA: { name: 'United States',  leader: 'Franklin D. Roosevelt',  ideology: 'Presidential democracy',   faction: null,        color: '#6fa08c', home: 'United States',            playable: true,  indicators: ind(869, 95, 90, 20, 70, 35, 12, 80, 15) },
  SOV: { name: 'Soviet Union',   leader: 'Joseph Stalin',          ideology: 'Communist dictatorship',   faction: 'Comintern', color: '#9e2b25', home: 'European Russia',          playable: true,  indicators: ind(366, 70, 90, 75, 30, 65, 20, 60, 55) },
  CHN: { name: 'China',          leader: 'Chiang Kai-shek',        ideology: 'Nationalist one-party state', faction: null,     color: '#e0a15a', home: 'Southwest China',          playable: true,  indicators: ind(288, 15, 50, 45, 5, 10, 30, 35, 75) },
  POL: { name: 'Poland',         leader: 'Ignacy Mościcki (President)', ideology: 'Authoritarian republic', faction: 'Allies', color: '#b9a3d6', home: 'Poland',                   playable: true,  indicators: ind(76, 25, 30, 45, 10, 25, 3, 65, 85) },

  CAN: { name: 'Canada',         leader: 'W. L. Mackenzie King',   ideology: 'Parliamentary democracy',  faction: null,        color: '#c7707f', home: 'Canada',        indicators: ind(40, 30, 70, 10, 15, 10, 2, 80, 40) },
  AUS: { name: 'Australia',      leader: 'Robert Menzies',         ideology: 'Parliamentary democracy',  faction: null,        color: '#cf8f7a', home: 'Australia',     indicators: ind(24, 20, 70, 10, 15, 10, 1, 80, 45) },
  NZL: { name: 'New Zealand',    leader: 'Michael Joseph Savage',  ideology: 'Parliamentary democracy',  faction: null,        color: '#b5767e', home: 'New Zealand',   indicators: ind(9, 10, 40, 5, 5, 5, 0.3, 80, 45) },
  SAF: { name: 'South Africa',   leader: 'J. B. M. Hertzog',       ideology: 'Parliamentary democracy',  faction: null,        color: '#a86a55', home: 'South Africa',  indicators: ind(15, 15, 60, 8, 3, 5, 0.5, 60, 30) },
  NED: { name: 'Netherlands',    leader: 'Dirk Jan de Geer',       ideology: 'Constitutional monarchy',  faction: null,        color: '#e08a3c', home: 'Netherlands',   indicators: ind(52, 30, 50, 15, 25, 10, 1, 75, 20) },
  BEL: { name: 'Belgium',        leader: 'Hubert Pierlot',         ideology: 'Constitutional monarchy',  faction: null,        color: '#c9b458', home: 'Belgium',       indicators: ind(40, 30, 45, 20, 3, 10, 1, 70, 25) },
  POR: { name: 'Portugal',       leader: 'António Salazar',        ideology: 'Authoritarian Estado Novo', faction: null,       color: '#3f8f6b', home: 'Portugal',      indicators: ind(15, 10, 40, 10, 10, 5, 1, 70, 15) },
  SPA: { name: 'Spain',          leader: 'Francisco Franco',       ideology: 'Nationalist dictatorship', faction: null,        color: '#c9a64a', home: 'Spain',         indicators: ind(40, 15, 35, 35, 15, 15, 3, 45, 10) },
  ROM: { name: 'Romania',        leader: 'King Carol II',          ideology: 'Royal dictatorship',       faction: null,        color: '#c9c06a', home: 'Romania',       indicators: ind(20, 12, 60, 30, 3, 10, 2, 45, 30) },
  YUG: { name: 'Yugoslavia',     leader: 'Prince Paul (Regent)',   ideology: 'Monarchy',                 faction: null,        color: '#8a86b8', home: 'Yugoslavia',        indicators: ind(22, 10, 40, 30, 5, 10, 2, 40, 30) },
  SVK: { name: 'Slovakia',       leader: 'Jozef Tiso',             ideology: 'Clerical-fascist client state', faction: null,   color: '#8f949a', home: 'Slovakia',      indicators: ind(6, 8, 20, 10, 0, 3, 0.5, 50, 30) },
  DEN: { name: 'Denmark',        leader: 'Thorvald Stauning',      ideology: 'Constitutional monarchy',  faction: null,        color: '#b0555f', home: 'Denmark',       indicators: ind(18, 20, 30, 5, 5, 3, 0.3, 80, 10) },
  FIN: { name: 'Finland',        leader: 'Kyösti Kallio (President)', ideology: 'Parliamentary republic', faction: null,       color: '#dfe3e8', home: 'Finland',       indicators: ind(12, 15, 30, 25, 3, 5, 0.4, 80, 60) },
  HUN: { name: 'Hungary',        leader: 'Miklós Horthy (Regent)', ideology: 'Authoritarian kingdom',  faction: null,        color: '#a8b38a', home: 'Hungary',       indicators: ind(24, 15, 30, 20, 0, 8, 1.5, 60, 40) },
  MAN: { name: 'Manchukuo',      leader: 'Puyi (puppet emperor)',  ideology: 'Japanese puppet state',    faction: 'Axis',      color: '#e6cf86', home: 'Manchukuo',     indicators: ind(30, 25, 50, 15, 0, 5, 3, 40, 20) },
  EGY: { name: 'Egypt',          leader: 'King Farouk',            ideology: 'Monarchy (British influence)', faction: null,    color: '#d8c38e', home: 'Egypt',         indicators: ind(20, 8, 30, 5, 1, 2, 1, 50, 20) },
  MON: { name: 'Mongolia',       leader: 'Khorloogiin Choibalsan', ideology: 'Communist (Soviet-aligned)', faction: 'Comintern', color: '#b8574d', home: 'Mongolia', indicators: ind(1, 2, 20, 10, 0, 2, 0.1, 60, 60) }
};

// Territory -> 1939 controller. Territory names come from the map file
// public/data/world-1939.json (built by tools/build-map.mjs). Any territory
// NOT listed here becomes its own minor nation automatically.
export const TERRITORY_OWNERS = {
  // Germany and its annexations (Austria 1938, Sudetenland 1938, Bohemia-Moravia and Memel March 1939, Danzig 1 Sept 1939)
  'Germany': 'GER', 'East Prussia': 'GER', 'Austria': 'GER', 'Bohemia and Moravia': 'GER', 'Danzig': 'GER',
  // Italy
  'Italy': 'ITA', 'Albania': 'ITA', 'Libya': 'ITA', 'Italian East Africa': 'ITA',
  // Japan and its puppet state
  'Japan': 'JAP', 'Korea': 'JAP', 'Taiwan': 'JAP', 'Karafuto': 'JAP', 'South Seas Mandate': 'JAP',
  'Manchukuo': 'MAN',
  // China (Nationalist government; much of the east is occupied, see START_OCCUPATION)
  'North China': 'CHN', 'East China': 'CHN', 'Central China': 'CHN', 'South China': 'CHN',
  'Southwest China': 'CHN', 'Northwest China': 'CHN', 'Inner Mongolia': 'CHN', 'Xinjiang': 'CHN',
  // Soviet Union
  'European Russia': 'SOV', 'Urals and Siberia': 'SOV', 'Soviet Far East': 'SOV', 'Soviet Ukraine': 'SOV',
  'Soviet Belarus': 'SOV', 'Transcaucasia': 'SOV', 'Soviet Central Asia': 'SOV', 'Mongolia': 'MON',
  // Poland (interwar borders)
  'Poland': 'POL', 'Eastern Poland': 'POL',
  // British Empire
  'United Kingdom': 'UK', 'Gibraltar': 'UK', 'Malta': 'UK', 'Cyprus': 'UK',
  'British India': 'UK', 'Burma': 'UK', 'Ceylon': 'UK', 'Malaya': 'UK', 'Singapore': 'UK', 'Hong Kong': 'UK',
  'Palestine': 'UK', 'Transjordan': 'UK', 'Kuwait': 'UK', 'Qatar': 'UK', 'Bahrain': 'UK', 'Trucial States': 'UK',
  'Anglo-Egyptian Sudan': 'UK', 'British Somaliland': 'UK', 'Kenya': 'UK', 'Uganda': 'UK', 'Tanganyika': 'UK',
  'Northern Rhodesia': 'UK', 'Southern Rhodesia': 'UK', 'Nyasaland': 'UK', 'Bechuanaland': 'UK', 'Basutoland': 'UK',
  'Swaziland': 'UK', 'Nigeria': 'UK', 'Gold Coast': 'UK', 'Sierra Leone': 'UK', 'Gambia': 'UK',
  'British Indian Ocean': 'UK', 'British Honduras': 'UK', 'British Guiana': 'UK', 'Falkland Islands': 'UK',
  'British West Indies': 'UK', 'British Pacific Islands': 'UK', 'Newfoundland': 'UK',
  // Dominions
  'Canada': 'CAN', 'Australia': 'AUS', 'New Guinea': 'AUS', 'New Zealand': 'NZL',
  'South Africa': 'SAF', 'South West Africa': 'SAF',
  // French Empire
  'France': 'FRA', 'Algeria': 'FRA', 'Tunisia': 'FRA', 'French Morocco': 'FRA', 'French West Africa': 'FRA',
  'French Equatorial Africa': 'FRA', 'French Cameroun': 'FRA', 'French Togoland': 'FRA', 'Madagascar': 'FRA',
  'French Somaliland': 'FRA', 'Syria and Lebanon': 'FRA', 'French Indochina': 'FRA', 'French Pacific Islands': 'FRA',
  'French Antilles': 'FRA', 'French Guiana': 'FRA',
  // Other empires
  'Netherlands': 'NED', 'Dutch East Indies': 'NED', 'Suriname': 'NED', 'Dutch Caribbean': 'NED',
  'Belgium': 'BEL', 'Belgian Congo': 'BEL',
  'Portugal': 'POR', 'Angola': 'POR', 'Mozambique': 'POR', 'Portuguese Guinea': 'POR', 'Portuguese Timor': 'POR', 'Macau': 'POR',
  'Spain': 'SPA', 'Spanish Morocco': 'SPA', 'Spanish Sahara': 'SPA', 'Spanish Guinea': 'SPA',
  'United States': 'USA', 'Alaska': 'USA', 'Hawaii': 'USA', 'Philippines': 'USA', 'Puerto Rico': 'USA', 'Guam': 'USA', 'US Pacific Islands': 'USA',
  'Denmark': 'DEN', 'Greenland': 'DEN',
  // Central and Eastern Europe
  'Romania': 'ROM', 'Bessarabia and Bukovina': 'ROM', 'Yugoslavia': 'YUG', 'Slovakia': 'SVK', 'Hungary': 'HUN',
  'Finland': 'FIN', 'Egypt': 'EGY'
};

// Territory names in the map file that should not be used.
export const IGNORED_TERRITORIES = [];

// Partial occupation at game start: territory -> { occupierTag: percent }
// Japan holds the cities, railways and coast of eastern China after 1937–38;
// the countryside is contested. Percentages are rough shares of control.
export const START_OCCUPATION = {
  'North China':    { JAP: 70 },   // Beijing, Tianjin, the railways (from 1937)
  'East China':     { JAP: 55 },   // Shanghai, Nanjing (1937)
  'Central China':  { JAP: 30 },   // Wuhan (October 1938)
  'South China':    { JAP: 25 },   // Canton (October 1938), Hainan (February 1939)
  'Inner Mongolia': { JAP: 45 }    // Mengjiang puppet regime
};

// Wars already in progress on 1 September 1939.
export const START_WARS = [
  ['GER', 'POL'],   // Invasion of Poland, 1 Sept 1939
  ['JAP', 'CHN'],   // Second Sino-Japanese War since July 1937
  ['MAN', 'CHN']
];

// Starting relations (-100 hostile .. +100 allied). Unlisted pairs default to 0.
export const START_RELATIONS = {
  'GER|SOV': 20,  // Molotov–Ribbentrop Pact
  'GER|ITA': 70, 'GER|JAP': 40, 'ITA|JAP': 30,
  'UK|FRA': 80, 'UK|POL': 60, 'FRA|POL': 60,
  'UK|USA': 45, 'FRA|USA': 30,
  'GER|UK': -40, 'GER|FRA': -40, 'GER|POL': -100,
  'JAP|CHN': -100, 'JAP|USA': -30, 'JAP|SOV': -50, 'JAP|MAN': 60, 'MAN|CHN': -80, 'GER|HUN': 40,
  'SOV|POL': -40, 'SOV|UK': -20, 'SOV|FRA': -20, 'USA|CHN': 30
};

// Extra names the player (or the LLM) might use for territories/nations.
export const ALIASES = {
  'usa': 'USA', 'us': 'USA', 'united states': 'USA', 'america': 'USA', 'american': 'USA',
  'uk': 'UK', 'britain': 'UK', 'great britain': 'UK', 'england': 'UK', 'british': 'UK',
  'ussr': 'SOV', 'soviet': 'SOV', 'soviets': 'SOV', 'soviet union': 'SOV', 'russia': 'SOV',
  'germany': 'GER', 'german': 'GER', 'germans': 'GER', 'reich': 'GER',
  'italy': 'ITA', 'italian': 'ITA', 'japan': 'JAP', 'japanese': 'JAP',
  'france': 'FRA', 'french': 'FRA', 'china': 'CHN', 'chinese': 'CHN', 'poland': 'POL', 'polish': 'POL',
  'canada': 'CAN', 'australia': 'AUS'
};

export const TERRITORY_ALIASES = {
  'usa': 'United States', 'america': 'United States', 'united states of america': 'United States', 'pearl harbor': 'Hawaii',
  'uk': 'United Kingdom', 'britain': 'United Kingdom', 'great britain': 'United Kingdom', 'england': 'United Kingdom', 'london': 'United Kingdom',
  'russia': 'European Russia', 'soviet union': 'European Russia', 'ussr': 'European Russia', 'moscow': 'European Russia',
  'leningrad': 'European Russia', 'stalingrad': 'European Russia', 'siberia': 'Urals and Siberia',
  'ukraine': 'Soviet Ukraine', 'kiev': 'Soviet Ukraine', 'belarus': 'Soviet Belarus', 'byelorussia': 'Soviet Belarus',
  'kaliningrad': 'East Prussia', 'königsberg': 'East Prussia', 'konigsberg': 'East Prussia', 'memel': 'East Prussia',
  'gdansk': 'Danzig', 'warsaw': 'Poland', 'lwow': 'Eastern Poland', 'lviv': 'Eastern Poland', 'wilno': 'Eastern Poland', 'vilnius': 'Eastern Poland', 'kresy': 'Eastern Poland',
  'czechoslovakia': 'Bohemia and Moravia', 'czechia': 'Bohemia and Moravia', 'czech republic': 'Bohemia and Moravia',
  'bohemia': 'Bohemia and Moravia', 'sudetenland': 'Bohemia and Moravia', 'prague': 'Bohemia and Moravia',
  'paris': 'France', 'berlin': 'Germany', 'rome': 'Italy', 'tokyo': 'Japan',
  'moldova': 'Bessarabia and Bukovina', 'bessarabia': 'Bessarabia and Bukovina',
  'manchuria': 'Manchukuo', 'beijing': 'North China', 'peking': 'North China', 'shanghai': 'East China', 'nanjing': 'East China',
  'nanking': 'East China', 'wuhan': 'Central China', 'canton': 'South China', 'guangzhou': 'South China', 'hainan': 'South China',
  'chongqing': 'Southwest China', 'chungking': 'Southwest China', 'yanan': 'Northwest China', "yan'an": 'Northwest China',
  'india': 'British India', 'pakistan': 'British India', 'bangladesh': 'British India', 'myanmar': 'Burma', 'sri lanka': 'Ceylon',
  'indochina': 'French Indochina', 'vietnam': 'French Indochina', 'laos': 'French Indochina', 'cambodia': 'French Indochina',
  'indonesia': 'Dutch East Indies', 'java': 'Dutch East Indies', 'sumatra': 'Dutch East Indies', 'borneo': 'Dutch East Indies',
  'malaysia': 'Malaya', 'sakhalin': 'Karafuto', 'kurils': 'Karafuto', 'saipan': 'South Seas Mandate', 'palau': 'South Seas Mandate',
  'israel': 'Palestine', 'jordan': 'Transjordan', 'syria': 'Syria and Lebanon', 'lebanon': 'Syria and Lebanon',
  'ethiopia': 'Italian East Africa', 'abyssinia': 'Italian East Africa', 'eritrea': 'Italian East Africa', 'somalia': 'Italian East Africa',
  'sudan': 'Anglo-Egyptian Sudan', 'congo': 'Belgian Congo', 'namibia': 'South West Africa', 'ghana': 'Gold Coast',
  'tanzania': 'Tanganyika', 'zambia': 'Northern Rhodesia', 'zimbabwe': 'Southern Rhodesia', 'persia': 'Iran', 'siam': 'Thailand',
  'serbia': 'Yugoslavia', 'croatia': 'Yugoslavia', 'slovenia': 'Yugoslavia', 'bosnia': 'Yugoslavia',
  'estonia': 'Estonia', 'latvia': 'Latvia', 'karelia': 'Finland'
};
