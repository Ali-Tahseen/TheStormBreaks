// Opening briefings for "China's War of Resistance" (September 1939).
// Same shape as server/data/advisors/ww2-1939.js. Written from the point of
// view of officials of each side at the time (no hindsight).

export const OPENING_ADVICE = {
  CHN: {
    economy: {
      outlook: 'critical',
      home: 'The government in Chongqing has lost the coast, customs revenue and most factories; printing money is driving prices up.',
      abroad: 'Aid arrives by the Haiphong railway in French Indochina, the Burma Road and the north-west route from the Soviet Union.',
      advice: 'Guard the supply routes and support the factories moved inland from Shanghai and Wuhan.'
    },
    diplomacy: {
      outlook: 'steady',
      home: 'The Second United Front with the Communists is fraying, and clashes between Nationalist and Communist units are growing.',
      abroad: 'Moscow is our main arms supplier. Washington and London offer loans, but Europe comes first for them now.',
      advice: 'Hold the United Front together for now and lobby the USA for more aid.'
    },
    military: {
      outlook: 'worrying',
      home: 'Our armies are huge but poorly equipped, and many divisions are loyal to provincial commanders first.',
      abroad: 'Japan is preparing to push towards Changsha in Hunan, but its forces are stretched thin across occupied China.',
      advice: 'Trade space for time, and make a stand at Changsha.'
    }
  },

  CCP: {
    economy: {
      outlook: 'worrying',
      home: 'The Shaan-Gan-Ning base around Yan’an is poor and remote; food, cloth and weapons are all scarce.',
      abroad: 'The Nationalist government pays a small subsidy to the Eighth Route Army, but it could be cut at any time.',
      advice: 'Reduce rents and interest to win the peasants, and make the base areas self-sufficient.'
    },
    diplomacy: {
      outlook: 'steady',
      home: 'Peasant support grows wherever the Party cuts rents and organises villages behind Japanese lines.',
      abroad: 'The Soviet Union is friendly but sends most of its aid to Chiang’s government, and the United Front is uneasy.',
      advice: 'Stay in the United Front in public while expanding your own base areas.'
    },
    military: {
      outlook: 'steady',
      home: 'The Eighth Route and New Fourth Armies are small and lightly armed, but disciplined and loyal to the Party.',
      abroad: 'Japan holds the cities and railways of North China but cannot control the villages between them.',
      advice: 'Avoid pitched battles, wage guerrilla war and preserve your forces.'
    }
  },

  JAP: {
    economy: {
      outlook: 'worrying',
      home: 'Two years of the war in China have strained the budget; rationing and price controls are spreading at home.',
      abroad: 'Japan buys most of its oil and scrap iron from the United States, which has given notice to end its trade treaty with us.',
      advice: 'Cut war costs where possible and build up oil stocks before American restrictions arrive.'
    },
    diplomacy: {
      outlook: 'worrying',
      home: 'Tokyo is shaken that Germany signed a pact with Moscow without warning Japan, and the cabinet has changed.',
      abroad: 'Chiang Kai-shek refuses to negotiate and is supplied by Moscow, Washington and London through Burma and Indochina.',
      advice: 'Look for a negotiated way out of the war, or at least cut the foreign routes that supply Chongqing.'
    },
    military: {
      outlook: 'worrying',
      home: 'Most of the army is tied down in China, and the defeat by Soviet forces at Nomonhan has shaken the high command.',
      abroad: 'Chinese armies fight on from the interior, while Communist guerrillas raid railways and garrisons in the north.',
      advice: 'Avoid overstretching: hold the cities and railways rather than chasing the enemy deeper inland.'
    }
  }
};

export default OPENING_ADVICE;
