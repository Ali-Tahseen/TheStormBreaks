// Real historical events of China's War of Resistance against Japan
// (1937–1945), with the world events that shaped it. Used by the History
// Teacher agent and the offline lesson generator for the China campaign.
//
// Fields: date (YYYY-MM-DD), title, summary, nations (tags involved),
//         concepts (key terms students should learn), dse (HKDSE History theme hint).

export const TIMELINE = [
  { date: '1937-07-07', title: 'Marco Polo Bridge Incident', nations: ['JAP', 'CHN'], concepts: ['War of Resistance', 'United Front'], dse: 'Conflicts and cooperation',
    summary: 'A clash near Beijing between Japanese and Chinese troops became the trigger for full-scale war. The Nationalists and Communists put aside their civil war and formed a Second United Front against Japan.' },
  { date: '1937-08-13', title: 'Battle of Shanghai', nations: ['JAP', 'CHN'], concepts: ['Total war', 'Urban warfare'], dse: 'Conflicts and cooperation',
    summary: 'Chiang Kai-shek committed his best German-trained divisions to defend Shanghai. After three months of brutal street fighting the city fell, but the battle showed that China would not surrender quickly.' },
  { date: '1937-12-13', title: 'Fall of Nanjing and the Nanjing Massacre', nations: ['JAP', 'CHN'], concepts: ['Atrocity', 'Occupation'], dse: 'Conflicts and cooperation',
    summary: 'Japanese forces captured the Nationalist capital and killed large numbers of civilians and prisoners of war. The government moved its capital inland to Chongqing and fought on.' },
  { date: '1938-06-09', title: 'Yellow River dykes breached', nations: ['CHN', 'JAP'], concepts: ['Scorched earth', 'Civilian cost'], dse: 'Conflicts and cooperation',
    summary: 'To slow the Japanese advance, Nationalist forces destroyed the Yellow River dykes. The floods delayed Japan but drowned hundreds of thousands of peasants and displaced millions.' },
  { date: '1938-10-25', title: 'Fall of Wuhan', nations: ['JAP', 'CHN'], concepts: ['Attrition', 'Strategic retreat'], dse: 'Conflicts and cooperation',
    summary: 'After a long campaign Japan took Wuhan, but the Chinese army withdrew rather than surrender. The war settled into a stalemate of attrition across a huge country.' },
  { date: '1939-09-01', title: 'War in Europe begins; China fights on alone in Asia', nations: ['GER', 'POL', 'CHN', 'JAP'], concepts: ['Global war', 'Isolation'], dse: 'Conflicts and cooperation',
    summary: 'Germany invaded Poland and the Second World War began in Europe. For more than two years China continued to resist Japan with only limited foreign help.' },
  { date: '1939-09-14', title: 'First Battle of Changsha', nations: ['CHN', 'JAP'], concepts: ['Defence in depth'], dse: 'Conflicts and cooperation',
    summary: 'Chinese forces turned back a Japanese attempt to take Changsha, the first time Japan failed to capture a major Chinese city it attacked.' },
  { date: '1940-08-20', title: 'Hundred Regiments Offensive', nations: ['CCP', 'JAP'], concepts: ['Guerrilla warfare', 'Base areas'], dse: 'Conflicts and cooperation',
    summary: 'Communist forces attacked Japanese railways and garrisons across north China. Japan responded with the “Three Alls” policy — burn all, kill all, loot all — devastating the countryside.' },
  { date: '1940-09-22', title: 'Japan occupies northern French Indochina', nations: ['JAP', 'FRA'], concepts: ['Expansion', 'Supply routes'], dse: 'Conflicts and cooperation',
    summary: 'Japan moved into Indochina to cut supply routes to China and prepare for war in the Pacific. This alarmed the United States and Britain.' },
  { date: '1941-04-13', title: 'Soviet–Japanese Neutrality Pact', nations: ['SOV', 'JAP'], concepts: ['Neutrality pact'], dse: 'Conflicts and cooperation',
    summary: 'The USSR and Japan promised not to attack each other. Japan could look south, and the Soviet Union could move troops west when Germany invaded.' },
  { date: '1941-12-07', title: 'Attack on Pearl Harbor; the war becomes truly global', nations: ['JAP', 'USA', 'CHN'], concepts: ['World war', 'Alliances'], dse: 'Conflicts and cooperation',
    summary: 'Japan attacked the United States and struck across Southeast Asia. China now had powerful allies and declared war on Japan, Germany and Italy.' },
  { date: '1941-12-25', title: 'Fall of Hong Kong', nations: ['JAP', 'UK', 'CAN', 'CHN'], concepts: ['Japanese occupation of Hong Kong'], dse: 'Hong Kong in the 20th century',
    summary: 'Japanese forces captured Hong Kong after 18 days. British, Canadian, Indian and local defenders surrendered on Christmas Day — “Black Christmas”. The occupation lasted three years and eight months.' },
  { date: '1942-01-01', title: 'Declaration by United Nations', nations: ['USA', 'UK', 'SOV', 'CHN'], concepts: ['Grand Alliance', 'Four Powers'], dse: 'Conflicts and cooperation',
    summary: 'China signed the declaration alongside the United States, Britain and the USSR, becoming one of the “Big Four” of the Allied war effort.' },
  { date: '1942-03-08', title: 'Chinese Expeditionary Force in Burma; Burma Road', nations: ['CHN', 'UK', 'USA', 'JAP'], concepts: ['Supply lines', 'Allied cooperation'], dse: 'Conflicts and cooperation',
    summary: 'China sent troops into Burma to protect the Burma Road, its main land supply line. After the Allies lost Burma, supplies were flown “over the Hump” until a new road could be built.' },
  { date: '1942-04-18', title: 'Doolittle Raid and the Zhejiang-Jiangxi campaign', nations: ['USA', 'CHN', 'JAP'], concepts: ['Retaliation', 'Civilian cost'], dse: 'Conflicts and cooperation',
    summary: 'After US bombers raided Tokyo and landed in China, Japan launched a brutal campaign through Zhejiang and Jiangxi, punishing the local population.' },
  { date: '1943-11-22', title: 'Cairo Conference', nations: ['USA', 'UK', 'CHN', 'JAP'], concepts: ['Great power status', 'Post-war planning'], dse: 'Conflicts and cooperation',
    summary: 'Roosevelt, Churchill and Chiang Kai-shek met and agreed that Japan must give up Taiwan, Manchuria and other occupied lands. China was recognised as a great power.' },
  { date: '1944-04-17', title: 'Operation Ichi-Go', nations: ['JAP', 'CHN'], concepts: ['Largest offensive', 'Weakness of the Nationalists'], dse: 'Conflicts and cooperation',
    summary: 'Japan’s largest offensive of the war overran much of central and south China and linked its railways to Indochina. It exposed the corruption and weakness of the Nationalist government, even as Allied victory neared.' },
  { date: '1945-01-27', title: 'Burma Road reopened', nations: ['CHN', 'USA', 'UK'], concepts: ['Lend-Lease', 'Logistics'], dse: 'Conflicts and cooperation',
    summary: 'The Ledo–Burma Road reopened, letting large amounts of American Lend-Lease supplies reach China by land again.' },
  { date: '1945-08-06', title: 'Atomic bombs and the Soviet invasion of Manchuria', nations: ['USA', 'JAP', 'SOV', 'CHN'], concepts: ['Nuclear weapons', 'End of the war'], dse: 'Conflicts and cooperation',
    summary: 'The US dropped atomic bombs on Hiroshima and Nagasaki, and the USSR invaded Japanese-held Manchuria. Japan’s defeat became certain within days.' },
  { date: '1945-09-02', title: 'Japan formally surrenders; China wins the War of Resistance', nations: ['JAP', 'USA', 'CHN', 'SOV', 'UK'], concepts: ['Victory', 'Post-war China'], dse: 'Conflicts and cooperation',
    summary: 'Japan surrendered after eight years of war in China and four years of world war. China had suffered perhaps 14 million or more deaths, and the civil war between Nationalists and Communists soon resumed.' }
];

export default TIMELINE;
