// Miniature flags for the nation swatches.
// Flags that were the same in 1939 come from the flag-icons library
// (square 1x1 versions, copied to /vendor/flag-icons). Flags that have since
// changed are drawn as period versions in /img/flags. Unknown tags fall back
// to the plain nation colour.

const LIB = (code) => `/vendor/flag-icons/1x1/${code}.svg`;
const OWN = (file) => `/img/flags/${file}.svg`;

const FLAGS = {
  // flag-icons (unchanged since 1939, or indistinguishable at this size)
  POL: LIB('pl'), JAP: LIB('jp'), UK: LIB('gb'), FRA: LIB('fr'), USA: LIB('us'),
  AUS: LIB('au'), NZL: LIB('nz'), NED: LIB('nl'), BEL: LIB('be'), POR: LIB('pt'),
  DEN: LIB('dk'), FIN: LIB('fi'), ROM: LIB('ro'), HUN: LIB('hu'), CHN: LIB('tw'),
  // period flags
  SOV: OWN('sov'), GER: OWN('ger-1939'), ITA: OWN('ita-1939'), MAN: OWN('man'),
  CCP: OWN('ccp'), YUG: OWN('yug'), SVK: OWN('svk-1939'), SPA: OWN('spa-1939'),
  EGY: OWN('egy-1939'), MON: OWN('mon-1939'), SAF: OWN('saf-1928'), CAN: OWN('can-1939'),

  // Minor nations. The engine creates these from map shapes, so their tag is
  // the territory name in capitals (Estonia -> ESTONIA).
  ARGENTINA: LIB('ar'), URUGUAY: LIB('uy'), CHILE: LIB('cl'), BOLIVIA: LIB('bo'), PERU: LIB('pe'),
  COSTA_RICA: LIB('cr'), NICARAGUA: LIB('ni'), BHUTAN: LIB('bt'), LITHUANIA: LIB('lt'), BRAZIL: LIB('br'),
  ESTONIA: LIB('ee'), LATVIA: LIB('lv'), NORWAY: LIB('no'), SWEDEN: LIB('se'), LUXEMBOURG: LIB('lu'),
  TURKEY: LIB('tr'), IRELAND: LIB('ie'), GREECE: LIB('gr'), LIBERIA: LIB('lr'), SWITZERLAND: LIB('ch'),
  SAUDI_ARABIA: LIB('sa'), BULGARIA: LIB('bg'), THAILAND: LIB('th'), HAITI: LIB('ht'),
  DOMINICAN_REPUBLIC: LIB('do'), EL_SALVADOR: LIB('sv'), GUATEMALA: LIB('gt'), CUBA: LIB('cu'),
  HONDURAS: LIB('hn'), ECUADOR: LIB('ec'), COLOMBIA: LIB('co'), PARAGUAY: LIB('py'), NEPAL: LIB('np'),
  MEXICO: LIB('mx'), PANAMA: LIB('pa'), VENEZUELA: LIB('ve'), ICELAND: LIB('is'),
  IRAN: OWN('irn-1939'), IRAQ: OWN('irq-1924'), AFGHANISTAN: OWN('afg-1931'), TIBET: OWN('tib'),
  MUSCAT_AND_OMAN: OWN('oma-1939'), YEMEN: OWN('yem-1927')
};

const safe = (s) => String(s ?? '').replace(/[^#\w%(),. -]/g, '');

// Inline style for a .swatch: the flag image, with the nation colour behind it.
export function swatchStyle(n) {
  const color = safe(n?.color);
  const url = FLAGS[n?.tag];
  return url ? `background:${color} url('${url}') center / cover no-repeat` : `background:${color}`;
}
