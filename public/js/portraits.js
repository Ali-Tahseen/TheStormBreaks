// Leader portraits for the country report (public/img/country_leaders_portraits).
// ------------------------------------------------------------------
// A portrait is matched to the nation's CURRENT leader, so if the game replaces
// a leader (set_leader, e.g. Chamberlain -> Churchill) the photo follows.
// Where the game names a head of government we have no photo of, the head of
// state of the time is shown instead and labelled as such.

const DIR = '/img/country_leaders_portraits';
const P = (file, name, role) => ({ src: `${DIR}/${file}.jpg`, name, role });

export const PORTRAITS = {
  abe:         P('abe', 'Nobuyuki Abe', 'Prime Minister of Japan, 1939–40'),
  antonescu:   P('antonescu', 'Ion Antonescu', 'Dictator (Conducător) of Romania, 1940–44'),
  boris:       P('boris', 'Boris III', 'Tsar of Bulgaria, 1918–43'),
  carol:       P('carol', 'Carol II', 'King of Romania, 1930–40'),
  chamberlain: P('chamberlain', 'Neville Chamberlain', 'Prime Minister of the United Kingdom, 1937–40'),
  churchill:   P('churchill', 'Winston Churchill', 'Prime Minister of the United Kingdom, 1940–45'),
  gaulle:      P('gaulle', 'Charles de Gaulle', 'Leader of Free France, 1940–44'),
  hitler:      P('hitler', 'Adolf Hitler', 'Dictator of Nazi Germany, 1933–45'),
  'kai-shek':  P('kai-shek', 'Chiang Kai-shek', 'Leader of the Nationalist government of China'),
  lebrun:      P('lebrun', 'Albert Lebrun', 'President of France, 1932–40'),
  mao:         P('mao', 'Mao Zedong', 'Leader of the Chinese Communist Party'),
  moscicki:    P('moscicki', 'Ignacy Mościcki', 'President of Poland, 1926–39'),
  mussolini:   P('mussolini', 'Benito Mussolini', 'Fascist dictator of Italy, 1922–43'),
  roosevelt:   P('roosevelt', 'Franklin D. Roosevelt', 'President of the United States, 1933–45'),
  stalin:      P('stalin', 'Joseph Stalin', 'Leader of the Soviet Union, 1924–53'),
  tito:        P('tito', 'Josip Broz Tito', 'Leader of the Yugoslav Partisans, 1941–45')
};

// Leader name (lower case, accents removed) -> portrait key.
const BY_LEADER = [
  [/hitler/, 'hitler'], [/mussolini/, 'mussolini'], [/stalin/, 'stalin'], [/roosevelt/, 'roosevelt'],
  [/chamberlain/, 'chamberlain'], [/churchill/, 'churchill'], [/gaulle/, 'gaulle'], [/lebrun/, 'lebrun'],
  [/chiang|kai-shek|kai shek/, 'kai-shek'], [/\bmao\b/, 'mao'], [/\babe\b/, 'abe'], [/antonescu/, 'antonescu'],
  [/\bcarol\b/, 'carol'], [/\bboris\b/, 'boris'], [/\btito\b/, 'tito'], [/moscicki/, 'moscicki']
];

// No photo of the named leader, but we have the head of state of the time.
const HEAD_OF_STATE = [
  { tag: 'FRA', leader: /daladier|reynaud/, key: 'lebrun' },  // President Lebrun served above both premiers
  { tag: 'BULGARIA', leader: /^government$/, key: 'boris' }    // Tsar Boris III reigned 1918–43
];

const plain = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * @param {object} nation a nation from the game state
 * @returns {{src, name, role, headOfState?: boolean} | null}
 */
export function portraitFor(nation) {
  if (!nation) return null;
  const leader = plain(nation.leader);
  for (const [re, key] of BY_LEADER) if (re.test(leader)) return PORTRAITS[key];
  const hos = HEAD_OF_STATE.find(h => h.tag === nation.tag && h.leader.test(leader));
  return hos ? { ...PORTRAITS[hos.key], headOfState: true } : null;
}
