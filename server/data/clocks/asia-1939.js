// Scripted events of the Asian war, fired by server/historyClock.js.
// ------------------------------------------------------------------
// Same data contract as the Europe pack (see europe-1939.js). Events whose
// preconditions involve the CCP only match in the China campaign, where the
// CCP exists and holds base areas behind Japanese lines; in the WWII
// campaign the predicates fail and the events no-op cleanly.

export const ASIA_1939 = [
  {
    // One South China blob cannot show a city battle cleanly, so Changsha is
    // a lesson: it feeds the Meanwhile list and the teacher, never the map.
    id: 'first_changsha',
    date: '1939-09-14',
    kind: 'lesson',
    actors: ['JAP', 'CHN'],
    title: 'First Battle of Changsha',
    blurb: 'Japanese forces attacked Changsha, the gateway to China’s interior; Chinese defenders held the city and claimed their first major victory of the war.',
    actions: []
  },
  {
    id: 'hundred_regiments',
    date: '1940-08-20',
    kind: 'map',
    actors: ['CCP'],
    title: 'The Hundred Regiments Offensive',
    blurb: 'Communist guerrillas launched the Hundred Regiments Offensive, sabotaging railways and mines across Japanese-held North China.',
    hint: 'the Communist Party launched the Hundred Regiments Offensive against Japanese-held railways and mines in North China.',
    requires: [
      { type: 'occupied_by', territory: 'North China', tag: 'CCP' },
      { type: 'not_capitulated', tag: 'CCP' }
    ],
    actions: [
      { type: 'occupy_territory', territory: 'North China', occupier: 'CCP', delta: 10 },
      { type: 'add_event', title: 'Hundred Regiments Offensive', description: 'Communist forces attacked Japanese-held railways and mines across North China, their largest operation of the war.', category: 'war', territories: ['North China'] }
    ]
  },
  {
    id: 'japan_indochina',
    date: '1940-09-22',
    kind: 'map',
    actors: ['JAP'],
    title: 'Japan moves into French Indochina',
    blurb: 'Japan stationed troops in French Indochina, closing the last railway supplying China from the south.',
    hint: 'Japan moved troops into French Indochina, closing another supply route to China.',
    requires: [
      { type: 'owner', territory: 'French Indochina', tag: 'FRA' }
    ],
    actions: [
      { type: 'occupy_territory', territory: 'French Indochina', occupier: 'JAP', percent: 100 },
      { type: 'add_event', title: 'Japan occupies French Indochina', description: 'Under pressure from Tokyo, the French colonial administration admitted Japanese troops, cutting a supply route to China.', category: 'war', territories: ['French Indochina'] }
    ]
  },
  {
    id: 'fall_of_hong_kong',
    date: '1941-12-25',
    kind: 'map',
    actors: ['JAP'],
    title: 'The fall of Hong Kong',
    blurb: 'Hong Kong surrendered to Japan on Christmas Day 1941 after eighteen days of fighting. The occupation lasted three years and eight months.',
    hint: 'Hong Kong surrendered to Japan on Christmas Day 1941 after eighteen days of fighting.',
    requires: [
      { type: 'owner', territory: 'Hong Kong', tag: 'UK' }
    ],
    actions: [
      { type: 'occupy_territory', territory: 'Hong Kong', occupier: 'JAP', percent: 100 },
      { type: 'add_event', title: 'The fall of Hong Kong', description: 'The garrison surrendered on Christmas Day. The Japanese occupation of Hong Kong lasted until August 1945.', category: 'war', territories: ['Hong Kong'] }
    ]
  },
  {
    id: 'lend_lease',
    date: '1941-03-11',
    kind: 'lesson',
    actors: ['USA', 'UK', 'SOV', 'CHN'],
    title: 'The Lend-Lease Act',
    blurb: 'The US began supplying weapons and goods to Britain (and later the USSR and China) without formally joining the war.',
    actions: []
  },
  {
    id: 'soviet_japan_pact',
    date: '1941-04-13',
    kind: 'lesson',
    actors: ['SOV', 'JAP'],
    title: 'Soviet–Japanese Neutrality Pact',
    blurb: 'The USSR and Japan agreed not to fight each other, letting Japan look south and later letting Stalin move troops west.',
    actions: []
  },
  {
    id: 'pearl_harbor',
    date: '1941-12-07',
    kind: 'map',
    actors: ['JAP'],
    title: 'Attack on Pearl Harbor',
    blurb: 'After the US cut off oil exports, Japan attacked the US Pacific Fleet and struck across Southeast Asia. The United States entered the war.',
    hint: 'Japan attacked the US Pacific Fleet at Pearl Harbor on 7 December 1941, bringing the United States into the war.',
    requires: [
      { type: 'not_at_war', a: 'JAP', b: 'USA' },
      { type: 'not_capitulated', tag: 'USA' }
    ],
    actions: [
      { type: 'declare_war', attacker: 'JAP', defender: 'USA' },
      { type: 'occupy_territory', territory: 'Philippines', occupier: 'JAP', percent: 100 },
      { type: 'add_event', title: 'Attack on Pearl Harbor', description: 'Japan attacked the US Pacific Fleet and struck across Southeast Asia, bringing the United States into the war.', category: 'war', territories: ['Hawaii', 'Philippines'] }
    ]
  },
  {
    id: 'singapore_falls',
    date: '1942-02-15',
    kind: 'map',
    actors: ['JAP'],
    title: 'The fall of Singapore',
    blurb: 'About 80,000 British Empire troops surrendered to Japan — a huge blow to Britain’s prestige in Asia.',
    hint: 'Japan captured Singapore on 15 February 1942; about 80,000 British Empire troops surrendered.',
    requires: [
      { type: 'owner', territory: 'Malaya', tag: 'UK' },
      { type: 'not_capitulated', tag: 'UK' }
    ],
    actions: [
      { type: 'occupy_territory', territory: 'Malaya', occupier: 'JAP', percent: 100 },
      { type: 'occupy_territory', territory: 'Singapore', occupier: 'JAP', percent: 100 },
      { type: 'add_event', title: 'The fall of Singapore', description: 'About 80,000 British Empire troops surrendered to Japan, a huge blow to Britain’s prestige in Asia.', category: 'war', territories: ['Malaya', 'Singapore'] }
    ]
  },
  {
    id: 'doolittle',
    date: '1942-04-18',
    kind: 'lesson',
    actors: ['USA', 'CHN', 'JAP'],
    title: 'The Doolittle Raid',
    blurb: 'US bombers raided Tokyo and landed in China. Japan responded with a brutal campaign through Zhejiang and Jiangxi, punishing the local population.',
    actions: []
  },
  {
    id: 'midway',
    date: '1942-06-04',
    kind: 'lesson',
    actors: ['USA', 'JAP'],
    title: 'The Battle of Midway',
    blurb: 'The US Navy sank four Japanese aircraft carriers. Japan lost the initiative in the Pacific.',
    actions: []
  },
  {
    id: 'burma_road',
    date: '1945-01-27',
    kind: 'lesson',
    actors: ['CHN', 'USA', 'UK'],
    title: 'The Burma Road reopens',
    blurb: 'The Ledo–Burma Road reopened, letting large amounts of American Lend-Lease supplies reach China by land again.',
    actions: []
  },
  {
    id: 'japan_surrender',
    date: '1945-09-02',
    kind: 'map',
    actors: ['JAP'],
    title: 'Japan formally surrenders',
    blurb: 'Japan signed the surrender aboard USS Missouri, ending the Second World War.',
    hint: 'Japan signed the surrender aboard USS Missouri on 2 September 1945, ending the Second World War.',
    requires: [
      { type: 'not_capitulated', tag: 'JAP' }
    ],
    actions: [
      { type: 'capitulate', country: 'JAP', occupier: 'USA', percent: 100 },
      { type: 'add_event', title: 'Japan formally surrenders', description: 'Japan signed the surrender aboard USS Missouri, ending the Second World War.', category: 'war', territories: ['Japan'] }
    ]
  }
];

export default ASIA_1939;
