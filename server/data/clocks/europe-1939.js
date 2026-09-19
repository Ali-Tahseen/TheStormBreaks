// Scripted events of the European war, fired by server/historyClock.js.
// ------------------------------------------------------------------
// Pure data: the clock validates and applies `actions` through the engine,
// so these events can only do what any agent action can do.
//
// kind 'map' events change the board in historical mode; in sandbox mode they
// are skipped (recorded in the turn debug). If the player's nation is one of
// `actors`, the event is left for the player to decide and only its `hint`
// is shown. `requires` preconditions make an event no-op when the player has
// already changed the board. `blurb` is the Meanwhile line when the event
// fires; `hint` completes the sentence "Historically this month, ..." when
// the event waits for the player's own order.

export const EUROPE_1939 = [
  {
    id: 'uk_fra_declare_war',
    date: '1939-09-03',
    kind: 'map',
    actors: ['UK', 'FRA'],
    title: 'Britain and France declare war on Germany',
    blurb: 'Britain and France honoured their guarantee to Poland and declared war on Germany on 3 September. The dominions followed within days.',
    hint: 'Britain and France honoured their guarantee to Poland and declared war on Germany.',
    actions: [
      { type: 'declare_war', attacker: 'UK', defender: 'GER' },
      { type: 'declare_war', attacker: 'FRA', defender: 'GER' },
      { type: 'add_event', title: 'Britain and France declare war on Germany', description: 'Honouring the guarantee to Poland, Britain and France declared war. Australia, New Zealand, South Africa and Canada followed within days.', category: 'war', territories: ['United Kingdom', 'France', 'Germany'] }
    ]
  },
  {
    id: 'soviet_eastern_poland',
    date: '1939-09-17',
    kind: 'map',
    actors: ['SOV'],
    title: 'The Red Army enters eastern Poland',
    blurb: 'On 17 September the Red Army crossed into eastern Poland, claiming the lands assigned to the USSR by the secret protocol of the Nazi–Soviet Pact.',
    hint: 'the Molotov–Ribbentrop secret protocol assigned eastern Poland to the USSR, and the Red Army crossed the border on 17 September.',
    requires: [
      { type: 'owner', territory: 'Eastern Poland', tag: 'POL' },
      { type: 'not_capitulated', tag: 'POL' }
    ],
    actions: [
      // Occupation only, no annexation: interwar Poland's fate stays visible.
      { type: 'occupy_territory', territory: 'Eastern Poland', occupier: 'SOV', percent: 100 },
      { type: 'add_event', title: 'Soviet Union occupies eastern Poland', description: 'Following the secret terms of the Nazi–Soviet Pact, the Red Army occupied eastern Poland.', category: 'war', territories: ['Eastern Poland'] }
    ]
  },
  {
    id: 'warsaw_falls',
    date: '1939-09-27',
    kind: 'map',
    actors: ['GER'],
    title: 'Warsaw falls',
    blurb: 'Warsaw surrendered on 27 September after weeks of bombing and siege. A Polish government-in-exile continued the fight from abroad.',
    hint: 'Warsaw surrendered to Germany on 27 September after weeks of bombing and siege.',
    requires: [
      { type: 'owner', territory: 'Poland', tag: 'POL' },
      { type: 'not_capitulated', tag: 'POL' }
    ],
    actions: [
      // The declaration covers campaigns where the September war is missing
      // (the engine rejects it where the war already exists). Poland keeps
      // its fully occupied territories: the tag survives as a
      // government-in-exile instead of being annexed off the map.
      { type: 'declare_war', attacker: 'GER', defender: 'POL' },
      { type: 'occupy_territory', territory: 'Poland', occupier: 'GER', percent: 100 },
      { type: 'add_event', title: 'Warsaw falls', description: 'After heavy bombing and siege, Warsaw surrendered. A Polish government-in-exile continued the fight from France and later London.', category: 'war', territories: ['Poland'] }
    ]
  },
  {
    id: 'winter_war',
    date: '1939-11-30',
    kind: 'map',
    actors: ['SOV'],
    title: 'The Winter War begins',
    blurb: 'On 30 November the Soviet Union attacked Finland. Finland resisted fiercely in the snow and forests, and the Red Army’s weak showing was noticed in Berlin.',
    hint: 'the Soviet Union attacked Finland on 30 November, starting the Winter War.',
    requires: [
      { type: 'not_at_war', a: 'SOV', b: 'FIN' },
      { type: 'not_capitulated', tag: 'FIN' }
    ],
    actions: [
      { type: 'declare_war', attacker: 'SOV', defender: 'FIN' },
      { type: 'occupy_territory', territory: 'Finland', occupier: 'SOV', percent: 30 },
      { type: 'add_event', title: 'Winter War: USSR attacks Finland', description: 'The Soviet Union invaded Finland. Finland resisted fiercely; the peace of March 1940 cost it territory.', category: 'war', territories: ['Finland'] }
    ]
  },
  {
    id: 'weserubung',
    date: '1940-04-09',
    kind: 'map',
    actors: ['GER'],
    title: 'Germany takes Denmark and Norway',
    blurb: 'Germany occupied Denmark in hours and landed in Norway on 9 April 1940, securing the Swedish iron-ore route and Atlantic ports.',
    hint: 'Germany occupied Denmark and invaded Norway on 9 April 1940 to secure the iron-ore route and Atlantic ports.',
    requires: [
      { type: 'owner', territory: 'Denmark', tag: 'DEN' },
      { type: 'not_capitulated', tag: 'DEN' }
    ],
    actions: [
      // NORWAY is the auto-created minor nation of the Norway map shape.
      // Declarations that duplicate an existing war are rejected harmlessly.
      { type: 'declare_war', attacker: 'GER', defender: 'DEN' },
      { type: 'declare_war', attacker: 'GER', defender: 'NORWAY' },
      { type: 'occupy_territory', territory: 'Denmark', occupier: 'GER', percent: 100 },
      { type: 'occupy_territory', territory: 'Norway', occupier: 'GER', percent: 100 },
      { type: 'add_event', title: 'Germany invades Denmark and Norway', description: 'Germany moved to secure Swedish iron-ore routes and Atlantic ports. Denmark fell in hours; Norway resisted for two months.', category: 'war', territories: ['Denmark', 'Norway'] }
    ]
  },
  {
    id: 'fall_of_france',
    date: '1940-05-10',
    kind: 'map',
    actors: ['GER'],
    title: 'The fall of France',
    blurb: 'German armour broke through the Ardennes on 10 May 1940. The Netherlands, Belgium and France fell within weeks, Churchill became Prime Minister, and Italy joined the war. France’s colonies stayed French under the armistice.',
    hint: 'Germany overran the Netherlands, Belgium and France in May and June 1940, and Churchill became Prime Minister in Britain.',
    requires: [
      { type: 'owner', territory: 'France', tag: 'FRA' },
      { type: 'not_capitulated', tag: 'FRA' }
    ],
    actions: [
      // Declarations come first: fully occupying a home territory only
      // capitulates a nation the occupier is at war with. Declarations that
      // duplicate an existing war are rejected by the engine and change
      // nothing. France capitulates with its colonies still French.
      { type: 'declare_war', attacker: 'GER', defender: 'NED' },
      { type: 'declare_war', attacker: 'GER', defender: 'BEL' },
      { type: 'declare_war', attacker: 'GER', defender: 'FRA' },
      { type: 'declare_war', attacker: 'ITA', defender: 'FRA' },
      { type: 'declare_war', attacker: 'ITA', defender: 'UK' },
      { type: 'occupy_territory', territory: 'Netherlands', occupier: 'GER', percent: 100 },
      { type: 'occupy_territory', territory: 'Belgium', occupier: 'GER', percent: 100 },
      { type: 'occupy_territory', territory: 'France', occupier: 'GER', percent: 100 },
      { type: 'set_leader', country: 'UK', leader: 'Winston Churchill' },
      { type: 'add_event', title: 'The fall of France', description: 'The Low Countries were overrun and France signed an armistice in June. Germany occupied the north and west; a collaborationist regime ruled from Vichy while the colonies stayed French.', category: 'war', territories: ['Netherlands', 'Belgium', 'France'] }
    ]
  },
  {
    id: 'winter_war_peace',
    date: '1940-03-12',
    kind: 'map',
    actors: ['SOV'],
    title: 'The Winter War ends',
    blurb: 'Finland ceded Karelia and other lands to the Soviet Union under the Moscow Peace Treaty, but kept its independence.',
    hint: 'the Soviet Union and Finland signed the Moscow Peace Treaty on 12 March 1940; Finland ceded Karelia but survived.',
    requires: [
      { type: 'at_war', a: 'SOV', b: 'FIN' },
      { type: 'not_capitulated', tag: 'FIN' }
    ],
    actions: [
      { type: 'make_peace', a: 'SOV', b: 'FIN' },
      { type: 'occupy_territory', territory: 'Finland', occupier: 'SOV', delta: 10 },
      { type: 'add_event', title: 'Moscow Peace Treaty', description: 'Finland ceded Karelia and other territory to the USSR but kept its independence.', category: 'war', territories: ['Finland'] }
    ]
  },
  {
    id: 'tripartite_pact',
    date: '1940-09-27',
    kind: 'lesson',
    actors: ['GER', 'ITA', 'JAP'],
    title: 'The Tripartite Pact',
    blurb: 'Germany, Italy and Japan formally allied, each promising support if attacked by a power not yet in the war — aimed at the United States.',
    actions: []
  },
  {
    id: 'barbarossa',
    date: '1941-06-22',
    kind: 'map',
    actors: ['GER'],
    title: 'Operation Barbarossa',
    blurb: 'Germany broke the Nazi–Soviet Pact and invaded the USSR with over three million soldiers. German armies overran western Soviet territory before winter.',
    hint: 'Germany broke the Nazi–Soviet Pact and invaded the Soviet Union on 22 June 1941.',
    requires: [
      { type: 'not_at_war', a: 'SOV', b: 'GER' },
      { type: 'not_capitulated', tag: 'SOV' }
    ],
    actions: [
      { type: 'declare_war', attacker: 'GER', defender: 'SOV' },
      { type: 'occupy_territory', territory: 'Soviet Ukraine', occupier: 'GER', percent: 55 },
      { type: 'occupy_territory', territory: 'Soviet Belarus', occupier: 'GER', percent: 65 },
      { type: 'occupy_territory', territory: 'European Russia', occupier: 'GER', percent: 25 },
      { type: 'add_event', title: 'Operation Barbarossa', description: 'Germany invaded the Soviet Union with over three million soldiers, overrunning western Soviet territory in the largest campaign of the war.', category: 'war', territories: ['Soviet Ukraine', 'Soviet Belarus', 'European Russia'] }
    ]
  },
  {
    id: 'moscow_counter',
    date: '1941-12-05',
    kind: 'lesson',
    actors: ['SOV', 'GER'],
    title: 'Soviet counter-attack at Moscow',
    blurb: 'German forces reached the edge of Moscow but were driven back in winter. Blitzkrieg had failed to defeat the USSR quickly.',
    actions: []
  },
  {
    id: 'usa_ger_war',
    date: '1941-12-11',
    kind: 'map',
    actors: ['GER', 'ITA'],
    title: 'Germany and Italy declare war on the United States',
    blurb: 'Hitler declared war on the United States, turning separate wars into a truly global conflict.',
    hint: 'Germany and Italy declared war on the United States on 11 December 1941.',
    requires: [
      { type: 'not_at_war', a: 'GER', b: 'USA' }
    ],
    actions: [
      { type: 'declare_war', attacker: 'GER', defender: 'USA' },
      { type: 'declare_war', attacker: 'ITA', defender: 'USA' },
      { type: 'add_event', title: 'Germany and Italy declare war on the USA', description: 'Hitler declared war on the United States, turning separate wars into a truly global conflict.', category: 'war', territories: ['Germany', 'United States'] }
    ]
  },
  {
    id: 'stalingrad',
    date: '1942-08-23',
    kind: 'lesson',
    actors: ['GER', 'SOV'],
    title: 'The Battle of Stalingrad',
    blurb: 'A brutal city battle ended in February 1943 with the surrender of the German Sixth Army — a turning point on the Eastern Front.',
    actions: []
  },
  {
    id: 'el_alamein',
    date: '1942-10-23',
    kind: 'lesson',
    actors: ['UK', 'GER', 'ITA'],
    title: 'Second Battle of El Alamein',
    blurb: 'British Commonwealth forces defeated Rommel’s Axis army in Egypt, protecting the Suez Canal.',
    actions: []
  },
  {
    id: 'kursk',
    date: '1943-07-05',
    kind: 'lesson',
    actors: ['GER', 'SOV'],
    title: 'The Battle of Kursk',
    blurb: 'The last major German offensive in the East failed. From now on the Red Army advanced westward.',
    actions: []
  },
  {
    id: 'italy_armistice',
    date: '1943-09-08',
    kind: 'map',
    actors: ['ITA'],
    title: 'Italy surrenders',
    blurb: 'After Allied landings in Sicily, Mussolini was deposed and Italy signed an armistice. Germany occupied the north and fighting continued.',
    hint: 'Italy signed an armistice on 8 September 1943; Germany occupied the north and the campaign continued.',
    requires: [
      { type: 'not_capitulated', tag: 'ITA' }
    ],
    actions: [
      { type: 'capitulate', country: 'ITA', occupier: 'GER', percent: 60, territories: ['Italy'] },
      { type: 'add_event', title: 'Italy surrenders', description: 'Mussolini was deposed and Italy signed an armistice. Germany occupied the north while the Allies advanced from the south.', category: 'war', territories: ['Italy'] }
    ]
  },
  {
    id: 'tehran',
    date: '1943-11-28',
    kind: 'lesson',
    actors: ['UK', 'USA', 'SOV'],
    title: 'The Tehran Conference',
    blurb: 'Churchill, Roosevelt and Stalin met for the first time and agreed on an invasion of France in 1944.',
    actions: []
  },
  {
    id: 'dday',
    date: '1944-06-06',
    kind: 'map',
    actors: ['UK', 'USA'],
    title: 'D-Day',
    blurb: 'Allied forces landed in Normandy — the largest seaborne invasion in history — opening a second front in Western Europe.',
    hint: 'Allied forces landed in Normandy on 6 June 1944, opening a second front in Western Europe.',
    requires: [
      { type: 'occupied_by', territory: 'France', tag: 'GER' },
      { type: 'not_capitulated', tag: 'GER' }
    ],
    actions: [
      { type: 'occupy_territory', territory: 'France', occupier: 'UK', delta: 25 },
      { type: 'occupy_territory', territory: 'France', occupier: 'USA', delta: 15 },
      { type: 'add_event', title: 'D-Day', description: 'Allied forces landed in Normandy, opening a second front in Western Europe and beginning the liberation of France.', category: 'war', territories: ['France'] }
    ]
  },
  {
    id: 'bagration',
    date: '1944-06-22',
    kind: 'map',
    actors: ['SOV'],
    title: 'Operation Bagration',
    blurb: 'A massive Soviet offensive destroyed German Army Group Centre and pushed the front westward into Poland.',
    hint: 'the Soviet Operation Bagration destroyed German Army Group Centre and pushed the Red Army into Poland.',
    requires: [
      { type: 'at_war', a: 'SOV', b: 'GER' },
      { type: 'not_capitulated', tag: 'SOV' }
    ],
    actions: [
      { type: 'liberate_territory', territory: 'Soviet Belarus', occupier: 'GER' },
      { type: 'liberate_territory', territory: 'Soviet Ukraine', occupier: 'GER' },
      { type: 'occupy_territory', territory: 'Poland', occupier: 'SOV', delta: 40 },
      { type: 'add_event', title: 'Operation Bagration', description: 'A Soviet offensive destroyed German Army Group Centre and pushed the Red Army into Poland.', category: 'war', territories: ['Soviet Belarus', 'Soviet Ukraine', 'Poland'] }
    ]
  },
  {
    id: 'yalta',
    date: '1945-02-04',
    kind: 'lesson',
    actors: ['UK', 'USA', 'SOV'],
    title: 'The Yalta Conference',
    blurb: 'The Allied leaders planned post-war Europe, including the division of Germany. Disagreements here foreshadowed the Cold War.',
    actions: []
  },
  {
    id: 've_day',
    date: '1945-05-08',
    kind: 'map',
    actors: ['SOV', 'UK', 'USA'],
    title: 'Victory in Europe',
    blurb: 'After Hitler’s death and the fall of Berlin, Germany surrendered unconditionally. The European war was over.',
    hint: 'Germany surrendered unconditionally on 8 May 1945, ending the war in Europe.',
    requires: [
      { type: 'not_capitulated', tag: 'GER' },
      { type: 'not_capitulated', tag: 'SOV' },
      { type: 'at_war', a: 'SOV', b: 'GER' }
    ],
    actions: [
      { type: 'occupy_territory', territory: 'Germany', occupier: 'SOV', percent: 40 },
      { type: 'occupy_territory', territory: 'Germany', occupier: 'UK', percent: 30 },
      { type: 'occupy_territory', territory: 'Germany', occupier: 'USA', percent: 30 },
      { type: 'capitulate', country: 'GER' },
      { type: 'add_event', title: 'Victory in Europe', description: 'Germany surrendered unconditionally, ending the war in Europe.', category: 'war', territories: ['Germany'] }
    ]
  },
  {
    id: 'pacific_atomic',
    date: '1945-08-06',
    kind: 'map',
    actors: ['USA', 'SOV'],
    title: 'Atomic bombs and the Soviet declaration of war on Japan',
    blurb: 'The US dropped atomic bombs on Hiroshima and Nagasaki, and the USSR declared war on Japan. Japan’s defeat became certain within days.',
    hint: 'the US dropped atomic bombs on Japan, and the Soviet Union declared war on Japan, in August 1945.',
    requires: [
      { type: 'not_at_war', a: 'SOV', b: 'JAP' },
      { type: 'not_capitulated', tag: 'JAP' }
    ],
    actions: [
      { type: 'occupy_territory', territory: 'Japan', occupier: 'USA', delta: 30 },
      { type: 'declare_war', attacker: 'SOV', defender: 'JAP' },
      { type: 'add_event', title: 'Atomic bombs and Soviet entry into the Pacific war', description: 'The US dropped atomic bombs on Hiroshima and Nagasaki, and the USSR declared war on Japan.', category: 'war', territories: ['Japan'] }
    ]
  }
];

export default EUROPE_1939;
