// Real historical events of the Second World War (1939–1945).
// The AI "history teacher" is given the events near the current game date so
// it can compare the student's alternate timeline with what really happened.
// Offline (mock) mode also uses this list to write lessons.
//
// Fields: date (YYYY-MM-DD), title, summary, nations (tags involved),
//         concepts (key terms students should learn), dse (HKDSE History theme hint).

export const TIMELINE = [
  { date: '1939-09-01', title: 'Germany invades Poland', nations: ['GER', 'POL'], concepts: ['Blitzkrieg'], dse: 'Conflicts and cooperation',
    summary: 'German forces attacked Poland using fast combined attacks of tanks, aircraft and infantry. This is usually seen as the start of the Second World War in Europe.' },
  { date: '1939-09-03', title: 'Britain and France declare war on Germany', nations: ['UK', 'FRA', 'GER'], concepts: ['Guarantee to Poland', 'End of appeasement'], dse: 'Conflicts and cooperation',
    summary: 'Having guaranteed Poland’s independence, Britain and France declared war. Dominions such as Australia, New Zealand, South Africa and Canada followed within days.' },
  { date: '1939-09-17', title: 'Soviet Union invades eastern Poland', nations: ['SOV', 'POL'], concepts: ['Molotov–Ribbentrop Pact', 'Spheres of influence'], dse: 'Conflicts and cooperation',
    summary: 'Following the secret terms of the Nazi–Soviet Pact, the Red Army occupied eastern Poland. Poland was divided between Germany and the USSR by the end of the month.' },
  { date: '1939-09-27', title: 'Warsaw surrenders', nations: ['GER', 'POL'], concepts: ['Occupation'], dse: 'Conflicts and cooperation',
    summary: 'After heavy bombing and siege, Warsaw surrendered. A Polish government-in-exile continued the fight from France and later London.' },
  { date: '1939-10-15', title: 'The “Phoney War”', nations: ['UK', 'FRA', 'GER'], concepts: ['Phoney War', 'Maginot Line'], dse: 'Conflicts and cooperation',
    summary: 'For months there was little fighting on the Western Front. France relied on the fortified Maginot Line and waited, while both sides rearmed.' },
  { date: '1939-11-30', title: 'Winter War: USSR attacks Finland', nations: ['SOV', 'FIN'], concepts: ['Winter War'], dse: 'Conflicts and cooperation',
    summary: 'The Soviet Union invaded Finland. Finland resisted fiercely; the peace of March 1940 cost it territory, and the Red Army’s weak performance was noticed in Berlin.' },
  { date: '1940-04-09', title: 'Germany invades Denmark and Norway', nations: ['GER', 'DEN'], concepts: ['Strategic resources'], dse: 'Conflicts and cooperation',
    summary: 'Germany moved to secure Swedish iron ore routes and Atlantic ports. Denmark fell in hours; Norway resisted for two months.' },
  { date: '1940-05-10', title: 'Invasion of France and the Low Countries; Churchill becomes Prime Minister', nations: ['GER', 'FRA', 'NED', 'BEL', 'UK'], concepts: ['Blitzkrieg', 'Leadership'], dse: 'Conflicts and cooperation',
    summary: 'German armoured forces broke through the Ardennes, bypassing the Maginot Line. The same day Winston Churchill replaced Chamberlain as British Prime Minister.' },
  { date: '1940-05-26', title: 'Dunkirk evacuation', nations: ['UK', 'FRA', 'GER'], concepts: ['Evacuation', 'Morale'], dse: 'Conflicts and cooperation',
    summary: 'Over 330,000 British and French soldiers were evacuated from Dunkirk by warships and civilian boats, saving the core of the British army.' },
  { date: '1940-06-10', title: 'Italy enters the war', nations: ['ITA', 'FRA', 'UK'], concepts: ['Opportunism'], dse: 'Conflicts and cooperation',
    summary: 'Mussolini declared war on France and Britain, expecting a short war and quick gains.' },
  { date: '1940-06-22', title: 'France signs armistice', nations: ['FRA', 'GER'], concepts: ['Vichy France', 'Collaboration', 'Resistance'], dse: 'Conflicts and cooperation',
    summary: 'France surrendered. Germany occupied the north and west; a collaborationist regime ruled from Vichy. Charles de Gaulle led the Free French from London.' },
  { date: '1940-07-10', title: 'Battle of Britain', nations: ['GER', 'UK'], concepts: ['Air superiority', 'Radar'], dse: 'Conflicts and cooperation',
    summary: 'The Luftwaffe tried to destroy the RAF to prepare an invasion. Radar and fighter defences helped Britain hold on; the invasion was postponed indefinitely.' },
  { date: '1940-09-27', title: 'Tripartite Pact', nations: ['GER', 'ITA', 'JAP'], concepts: ['Axis alliance'], dse: 'Conflicts and cooperation',
    summary: 'Germany, Italy and Japan formally allied, each promising support if attacked by a power not yet in the war — aimed at the United States.' },
  { date: '1941-03-11', title: 'Lend-Lease Act', nations: ['USA', 'UK', 'SOV', 'CHN'], concepts: ['Lend-Lease', 'Isolationism'], dse: 'Conflicts and cooperation',
    summary: 'The US began supplying weapons and goods to Britain (and later the USSR and China) without formally joining the war.' },
  { date: '1941-04-13', title: 'Soviet–Japanese Neutrality Pact', nations: ['SOV', 'JAP'], concepts: ['Neutrality pact'], dse: 'Conflicts and cooperation',
    summary: 'The USSR and Japan agreed not to fight each other, letting Japan look south and later letting Stalin move troops west.' },
  { date: '1941-06-22', title: 'Operation Barbarossa', nations: ['GER', 'SOV'], concepts: ['Lebensraum', 'Total war'], dse: 'Conflicts and cooperation',
    summary: 'Germany broke the Nazi–Soviet Pact and invaded the USSR with over three million soldiers. The Eastern Front became the largest and deadliest theatre of the war.' },
  { date: '1941-12-05', title: 'Soviet counter-attack at Moscow', nations: ['SOV', 'GER'], concepts: ['Overextension'], dse: 'Conflicts and cooperation',
    summary: 'German forces reached the edge of Moscow but were driven back in winter. Blitzkrieg had failed to defeat the USSR quickly.' },
  { date: '1941-12-07', title: 'Attack on Pearl Harbor', nations: ['JAP', 'USA'], concepts: ['Pre-emptive strike', 'Oil embargo'], dse: 'Conflicts and cooperation',
    summary: 'After the US cut off oil exports, Japan attacked the US Pacific Fleet and struck across Southeast Asia. The United States entered the war.' },
  { date: '1941-12-08', title: 'Battle of Hong Kong begins', nations: ['JAP', 'UK', 'CAN'], concepts: ['Japanese occupation of Hong Kong'], dse: 'Hong Kong in the 20th century',
    summary: 'Japanese forces attacked Hong Kong hours after Pearl Harbor. British, Canadian, Indian and local defenders surrendered on 25 December 1941 — “Black Christmas”. The occupation lasted three years and eight months.' },
  { date: '1941-12-11', title: 'Germany and Italy declare war on the USA', nations: ['GER', 'ITA', 'USA'], concepts: ['World war'], dse: 'Conflicts and cooperation',
    summary: 'Hitler declared war on the United States, turning separate wars into a truly global conflict.' },
  { date: '1942-01-20', title: 'Wannsee Conference and the Holocaust', nations: ['GER'], concepts: ['Holocaust', 'Genocide'], dse: 'Conflicts and cooperation',
    summary: 'Nazi officials coordinated the “Final Solution” — the systematic murder of Europe’s Jews. About six million Jews were killed in the Holocaust, along with millions of other victims of Nazi persecution.' },
  { date: '1942-02-15', title: 'Fall of Singapore', nations: ['JAP', 'UK'], concepts: ['Decline of European empires'], dse: 'Conflicts and cooperation',
    summary: 'About 80,000 British Empire troops surrendered to Japan — a huge blow to Britain’s prestige in Asia.' },
  { date: '1942-06-04', title: 'Battle of Midway', nations: ['USA', 'JAP'], concepts: ['Turning point', 'Aircraft carriers'], dse: 'Conflicts and cooperation',
    summary: 'The US Navy sank four Japanese aircraft carriers. Japan lost the initiative in the Pacific.' },
  { date: '1942-08-23', title: 'Battle of Stalingrad', nations: ['GER', 'SOV'], concepts: ['Turning point', 'Attrition'], dse: 'Conflicts and cooperation',
    summary: 'A brutal city battle ended in February 1943 with the surrender of the German Sixth Army — a turning point on the Eastern Front.' },
  { date: '1942-10-23', title: 'Second Battle of El Alamein', nations: ['UK', 'GER', 'ITA'], concepts: ['North African campaign'], dse: 'Conflicts and cooperation',
    summary: 'British Commonwealth forces defeated Rommel’s Axis army in Egypt, protecting the Suez Canal.' },
  { date: '1943-07-05', title: 'Battle of Kursk', nations: ['GER', 'SOV'], concepts: ['Industrial war'], dse: 'Conflicts and cooperation',
    summary: 'The last major German offensive in the East failed. From now on the Red Army advanced westward.' },
  { date: '1943-09-08', title: 'Italy surrenders', nations: ['ITA', 'UK', 'USA', 'GER'], concepts: ['Regime change'], dse: 'Conflicts and cooperation',
    summary: 'After Allied landings in Sicily, Mussolini was deposed and Italy signed an armistice. Germany occupied much of Italy and fighting continued.' },
  { date: '1943-11-28', title: 'Tehran Conference', nations: ['UK', 'USA', 'SOV'], concepts: ['Grand Alliance', 'Second front'], dse: 'Conflicts and cooperation',
    summary: 'Churchill, Roosevelt and Stalin met for the first time and agreed on an invasion of France in 1944.' },
  { date: '1944-06-06', title: 'D-Day', nations: ['USA', 'UK', 'CAN', 'GER'], concepts: ['Amphibious invasion', 'Second front'], dse: 'Conflicts and cooperation',
    summary: 'Allied forces landed in Normandy — the largest seaborne invasion in history — opening a second front in Western Europe.' },
  { date: '1944-06-22', title: 'Operation Bagration', nations: ['SOV', 'GER'], concepts: ['Deep operations'], dse: 'Conflicts and cooperation',
    summary: 'A massive Soviet offensive destroyed German Army Group Centre and pushed the front toward Poland.' },
  { date: '1945-02-04', title: 'Yalta Conference', nations: ['UK', 'USA', 'SOV'], concepts: ['Spheres of influence', 'Origins of the Cold War', 'United Nations'], dse: 'Conflicts and cooperation',
    summary: 'The Allied leaders planned post-war Europe, including the division of Germany. Disagreements here foreshadowed the Cold War.' },
  { date: '1945-05-08', title: 'Victory in Europe', nations: ['GER', 'UK', 'USA', 'SOV', 'FRA'], concepts: ['Unconditional surrender'], dse: 'Conflicts and cooperation',
    summary: 'After Hitler’s death on 30 April and the fall of Berlin, Germany surrendered unconditionally.' },
  { date: '1945-08-06', title: 'Atomic bombs and Soviet entry into the Pacific war', nations: ['USA', 'JAP', 'SOV'], concepts: ['Nuclear weapons', 'Ethics of war'], dse: 'Conflicts and cooperation',
    summary: 'The US dropped atomic bombs on Hiroshima (6 August) and Nagasaki (9 August); the USSR declared war on Japan on 8 August. Historians still debate which factor mattered most for Japan’s surrender.' },
  { date: '1945-08-30', title: 'Britain returns to Hong Kong', nations: ['UK', 'JAP'], concepts: ['Decolonisation'], dse: 'Hong Kong in the 20th century',
    summary: 'British forces reoccupied Hong Kong after Japan’s surrender, ending three years and eight months of Japanese occupation.' },
  { date: '1945-09-02', title: 'Japan formally surrenders', nations: ['JAP', 'USA', 'UK', 'CHN', 'SOV'], concepts: ['End of WWII', 'United Nations'], dse: 'Conflicts and cooperation',
    summary: 'Japan signed the surrender aboard USS Missouri, ending the Second World War. Around 70–85 million people had died.' }
];

// Events between two dates (inclusive), each as {year, month}.
export function eventsBetween(from, to) {
  const a = from.year * 12 + (from.month - 1);
  const b = to.year * 12 + (to.month - 1);
  return TIMELINE.filter(e => {
    const [y, m] = e.date.split('-').map(Number);
    const k = y * 12 + (m - 1);
    return k >= a && k <= b;
  });
}

// The real events closest to a date (default: 2 months back, 4 ahead).
export function eventsNear(date, back = 2, ahead = 4) {
  const idx = date.year * 12 + (date.month - 1);
  const from = { year: Math.floor((idx - back) / 12), month: ((idx - back) % 12) + 1 };
  const to = { year: Math.floor((idx + ahead) / 12), month: ((idx + ahead) % 12) + 1 };
  return eventsBetween(from, to);
}
