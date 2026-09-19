// Scenario: "China's War of Resistance" — the Second Sino-Japanese War in the
// context of the Second World War, 1939–1945.
// ------------------------------------------------------------------
// This scenario is pure data. It reuses the 1939 world map and the world
// powers from the WWII scenario, then overrides China and adds the Chinese
// Communist Party (CCP) as an uneasy ally of the Nationalist government.
// The CCP owns its northwestern base area (Shaanxi–Gansu–Ningxia, around
// Yan'an); its other base areas behind Japanese lines are shown as occupation
// stripes inside Nationalist territory.

import { SCENARIO as WW2 } from './ww2-1939.js';
import { TIMELINE } from '../timelines/china-1939.js';
import { OPENING_ADVICE } from '../advisors/china-1939.js';
import { EUROPE_1939 } from '../clocks/europe-1939.js';
import { ASIA_1939 } from '../clocks/asia-1939.js';

export const SCENARIO = {
  id: 'china-1939',
  title: 'China’s War of Resistance',
  subtitle: 'China against Japan, 1939–1945',
  era: 'the Second World War in Asia',
  setting: 'in 1939, when China had already been fighting Japan for two years',
  startDate: { year: 1939, month: 9 },
  endDate: { year: 1945, month: 9 },
  mapFile: 'world-1939.json',
  defaultView: 'china',
  endReason: 'Japan has surrendered and China’s War of Resistance is over.',
  playerEndReason: 'You chose to end the campaign.',
  startEvent: {
    title: 'China fights on as war begins in Europe',
    description: 'Germany invades Poland, but for China the war with Japan has already lasted two years. The Nationalist government holds the interior from Chongqing, while Communist guerrillas operate behind Japanese lines.',
    category: 'war',
    territories: ['Poland', 'North China']
  },
  rivalGuidance: 'e.g. Japan presses for a quick victory and punishes guerrilla areas; the USA and Britain give aid to China but put Europe first; the Soviet Union avoids a two-front war; the CCP and Nationalists cooperate uneasily while preparing for the post-war struggle',
  teacherContext: 'preparing for HKDSE, IGCSE or AP history, with an emphasis on China’s War of Resistance and the Japanese occupation of Hong Kong',
  timeline: TIMELINE,
  // Both clock packs attach here too (set explicitly, not spread from WW2):
  // the European partition still happens while the player fights in China.
  scriptedEvents: [...EUROPE_1939, ...ASIA_1939],
  // What each playable nation's advisors say before the first order.
  openingAdvice: OPENING_ADVICE,

  briefing: [
    {
      heading: 'A nation already at war',
      text: 'Japan seized Manchuria in 1931 and attacked China proper in 1937. After the Marco Polo Bridge Incident, Nationalists and Communists formed a Second United Front against the invader, but they distrusted each other deeply.'
    },
    {
      heading: 'Defeat after defeat',
      text: 'Japan took Shanghai, Nanjing and Wuhan. The Nationalist government moved its capital to Chongqing, far up the Yangtze. The Nanjing Massacre (1937) showed the human cost of the war and hardened Chinese resistance.'
    },
    {
      heading: 'Two ways to fight',
      text: 'Chiang Kai-shek’s Nationalists fought with large, often poorly equipped armies and relied on foreign aid. Mao Zedong’s Communists built base areas in the countryside and waged guerrilla war, winning peasant support through land reform.'
    },
    {
      heading: 'Alone, then with allies',
      text: 'Until December 1941 China fought almost alone, supplied only by the Burma Road and the air route “over the Hump”. After Pearl Harbor, China became one of the Allied “Big Four” and received Lend-Lease aid.'
    },
    {
      heading: 'Today: September 1939',
      text: 'War has just begun in Europe. Japan occupies the coast and the great cities; China holds the interior. Can you wear down Japan, hold the United Front together and prepare for the peace?'
    }
  ],

  indicators: WW2.indicators,
  factions: {
    ...WW2.factions,
    'United Front': { color: '#b5651d', help: 'The uneasy wartime alliance between the Nationalists (KMT) and the Chinese Communist Party (CCP) against Japan.' }
  },
  minorIndicators: WW2.minorIndicators,

  nations: {
    ...WW2.nations,
    // The China campaign is about the Chinese resistance, so the great powers
    // stay AI-controlled. The playable nations are CHN, CCP and JAP.
    GER: { ...WW2.nations.GER, playable: false },
    ITA: { ...WW2.nations.ITA, playable: false },
    UK:  { ...WW2.nations.UK,  playable: false },
    FRA: { ...WW2.nations.FRA, playable: false },
    USA: { ...WW2.nations.USA, playable: false },
    SOV: { ...WW2.nations.SOV, playable: false },
    POL: { ...WW2.nations.POL, playable: false },
    // China as it stood in 1939: huge manpower and will to fight, but a weak
    // industrial base, almost no navy or air force, and a fragile government.
    CHN: {
      name: 'Republic of China', leader: 'Chiang Kai-shek', ideology: 'Nationalist one-party state',
      faction: null, color: '#e0a15a', home: 'Southwest China', playable: true,
      indicators: { gdp: 180, industry: 12, resources: 45, army: 55, navy: 3, air: 8, manpower: 35, stability: 30, war_support: 80, army_support: 50, citizen_support: 55 }
    },
    // The Chinese Communist Party: small, disciplined, guerrilla-based, and
    // officially allied with the Nationalists through the United Front.
    CCP: {
      name: 'Chinese Communist Party', leader: 'Mao Zedong', ideology: 'Communist movement',
      faction: 'United Front', color: '#c0392b', home: 'Northwest China', playable: true,
      indicators: { gdp: 25, industry: 5, resources: 25, army: 25, navy: 0, air: 0, manpower: 8, stability: 55, war_support: 90, army_support: 90, citizen_support: 70 }
    }
  },

  // The Communist base area around Yan'an is CCP-held; the rest of China
  // stays with the Nationalist government.
  territoryOwners: { ...WW2.territoryOwners, 'Northwest China': 'CCP' },

  ignoredTerritories: WW2.ignoredTerritories,

  // Japanese-held coast and cities, plus Communist guerrilla base areas behind
  // the lines (the CCP's own northwestern base area is owned, not occupied).
  startOccupation: {
    'North China':    { JAP: 55, CCP: 20 },
    'East China':     { JAP: 55 },
    'Central China':  { JAP: 30 },
    'South China':    { JAP: 25 },
    'Inner Mongolia': { JAP: 45 }
  },

  startWars: [
    ['JAP', 'CHN'],
    ['MAN', 'CHN'],
    ['JAP', 'CCP'],
    ['MAN', 'CCP']
  ],

  startRelations: {
    ...WW2.startRelations,
    'CHN|CCP': 25,    // Second United Front, suspicious on both sides
    'CHN|USA': 60, 'CHN|UK': 45, 'CHN|SOV': 35,
    'CCP|SOV': 70, 'CCP|USA': -10, 'CCP|UK': -10,
    'JAP|CCP': -100, 'MAN|CCP': -90,
    'GER|CHN': 10
  },

  aliases: {
    ...WW2.aliases,
    'ccp': 'CCP', 'communists': 'CCP', 'communist': 'CCP', 'mao': 'CCP', 'mao zedong': 'CCP',
    'nationalists': 'CHN', 'nationalist': 'CHN', 'kmt': 'CHN', 'kuomintang': 'CHN', 'chiang': 'CHN', 'chiang kai-shek': 'CHN',
    'republic of china': 'CHN'
  },

  territoryAliases: {
    ...WW2.territoryAliases,
    'shaanxi': 'Northwest China', 'gansu': 'Northwest China', 'ningxia': 'Northwest China',
    'taiwan': 'Taiwan', 'formosa': 'Taiwan'
  },

  suggestions: {
    CHN: [
      'Withdraw the government and industry to Chongqing and wear Japan down',
      'Ask the USA for Lend-Lease aid and the Flying Tigers',
      'Keep the United Front with the Communists while conserving your armies',
      'Open the Burma Road to bring in supplies',
      'Hold Changsha and counter-attack when Japan strikes south in 1941'
    ],
    CCP: [
      'Expand guerrilla base areas behind Japanese lines',
      'Carry out land reform to win peasant support',
      'Avoid pitched battles and preserve your forces',
      'Coordinate with the Nationalists against Japan',
      'Ask the Soviet Union for weapons and advisers'
    ],
    JAP: [
      'Launch a major offensive to break Chinese resistance',
      'Bomb Chongqing into submission',
      'Secure the Burma Road to cut Allied aid to China'
    ]
  }
};

export default SCENARIO;
