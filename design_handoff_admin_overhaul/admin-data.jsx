/* Mock data for the admin prototype. Numbers tuned to feel like a real
   inventory of ~256 items so the views aren't suspiciously sparse. */

const LINES = [
  { slug: 'sh-figuarts', name: 'S.H.Figuarts', brand: 'Tamashii Nations' },
  { slug: 'myth-cloth',  name: 'Saint Cloth Myth', brand: 'Tamashii Nations' },
  { slug: 'myth-cloth-ex', name: 'Saint Cloth Myth EX', brand: 'Tamashii Nations' },
  { slug: 'figuarts-zero', name: 'Figuarts Zero', brand: 'Tamashii Nations' },
  { slug: 'popup-parade', name: 'Pop Up Parade', brand: 'Good Smile Company' },
  { slug: 'variable-action-heroes', name: 'Variable Action Heroes', brand: 'MegaHouse' },
  { slug: 'proplica', name: 'PROPLICA', brand: 'Tamashii Nations' },
  { slug: 'otros', name: 'Otros', brand: 'Otros' },
];

const SERIES = [
  'Dragon Ball Z', 'Dragon Ball Super', 'Saint Seiya', 'Jujutsu Kaisen',
  'Demon Slayer', 'Chainsaw Man', 'My Hero Academia', 'Bleach',
  'Berserk', 'Spy x Family', 'Haikyuu',
];

const STATUSES = ['available', 'reserved', 'sold', 'draft'];
const CONDITIONS = ['mint_sealed', 'mint_open', 'good', 'fair'];

const SAMPLE_NAMES = [
  'Suguru Geto', 'Satoru Gojo', 'Nobara Kugisaki', 'Megumi Fushiguro', 'Sukuna',
  'Yuji Itadori', 'Son Goku', 'Vegeta', 'Trunks', 'Gohan', 'Piccolo', 'Frieza',
  'Cell', 'Majin Buu', 'Bardock', 'Raditz', 'Nappa', 'Tien Shinhan', 'Krillin',
  'Yamcha', 'Saga de Gemini', 'Aiolos de Sagitario', 'Shaka de Virgo', 'Mu de Aries',
  'Aldebaran de Tauro', 'Milo de Escorpio', 'Camus de Acuario', 'Aphrodite de Piscis',
  'Death Mask de Cancer', 'Shiryu de Dragon', 'Hyoga de Cisne', 'Seiya de Pegaso',
  'Ikki de Fenix', 'Shun de Andromeda', 'Babel de Centaurus', 'Capella de Auriga',
  'Moses de Whale', 'Jabu de Unicorn', 'Tatsumi Oga', 'Power', 'Denji',
  'Makima', 'Pochita', 'Yor Forger', 'Loid Forger', 'Anya Forger',
];

const SUFFIXES = [
  '', '(Exclusive Edition)', '(Tamashii Web)', '(Z Warrior)', '(Boyhood)',
  '(Combat Power of 24,000)', '(Old Battle Uniforms)', '(Awakening)',
  '(Battle Suit)', '(Effect Parts Set)', '(Kaio-ken)', '— Glowing Set',
  '(Journey to Namek)', '(Legendary Super Saiyan)',
];

const RNG = (() => {
  // deterministic PRNG so the prototype renders the same numbers every refresh
  let s = 1337;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
})();

const pick = (arr) => arr[Math.floor(RNG() * arr.length)];
const pickWeighted = (entries) => {
  const total = entries.reduce((a, [, w]) => a + w, 0);
  let r = RNG() * total;
  for (const [v, w] of entries) { if ((r -= w) <= 0) return v; }
  return entries[0][0];
};

const PRODUCTS = (() => {
  const out = [];
  const today = new Date('2026-05-15T12:00:00');
  for (let i = 0; i < 256; i++) {
    const line = pickWeighted([
      ['sh-figuarts', 84], ['myth-cloth', 28], ['myth-cloth-ex', 22],
      ['figuarts-zero', 16], ['popup-parade', 47], ['variable-action-heroes', 9],
      ['proplica', 8], ['otros', 6],
    ]);
    const status = pickWeighted([
      ['available', 241], ['reserved', 7], ['sold', 3], ['draft', 5],
    ]);
    const condition = pickWeighted([
      ['mint_sealed', 180], ['mint_open', 50], ['good', 18], ['fair', 8],
    ]);
    const series = pick(SERIES);
    const name = pick(SAMPLE_NAMES);
    const suffix = pick(SUFFIXES);
    const price = status === 'draft' ? 0 : Math.round((60 + RNG() * 400) / 5) * 5;
    const daysAgoCreated = Math.floor(RNG() * 365);
    const daysAgoUpdated = Math.floor(RNG() * Math.min(daysAgoCreated, 60));
    const created = new Date(today); created.setDate(today.getDate() - daysAgoCreated);
    const updated = new Date(today); updated.setDate(today.getDate() - daysAgoUpdated);
    const reservedAt = status === 'reserved' ? new Date(today.getTime() - Math.floor(RNG() * 25) * 86400000) : null;
    const soldAt = status === 'sold' ? new Date(today.getTime() - Math.floor(RNG() * 90) * 86400000) : null;
    const hasPhoto = status === 'draft' ? RNG() > 0.5 : RNG() > 0.04;
    const hasDesc = status === 'draft' ? RNG() > 0.7 : RNG() > 0.18;
    out.push({
      id: `p-${i + 1}`,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + (i + 1),
      name: suffix ? `${name} ${suffix}` : name,
      line, series, status, condition, price,
      created, updated, reservedAt, soldAt,
      hasPhoto, hasDesc,
    });
  }
  return out;
})();

// Calibrate top counters to feel like the screenshot (256 / 241 / 7 / 3)
const COUNTERS = {
  total: PRODUCTS.length,
  available: PRODUCTS.filter(p => p.status === 'available').length,
  reserved: PRODUCTS.filter(p => p.status === 'reserved').length,
  sold: PRODUCTS.filter(p => p.status === 'sold').length,
  draft: PRODUCTS.filter(p => p.status === 'draft').length,
};

const INVENTORY_VALUE = {
  available: PRODUCTS.filter(p => p.status === 'available').reduce((a, p) => a + p.price, 0),
  reserved: PRODUCTS.filter(p => p.status === 'reserved').reduce((a, p) => a + p.price, 0),
  sold: PRODUCTS.filter(p => p.status === 'sold').reduce((a, p) => a + p.price, 0),
};

// Sales history — last 90 days, count of items flipped to sold per day (mock).
const SALES_HISTORY = (() => {
  const out = [];
  for (let i = 89; i >= 0; i--) {
    const d = new Date('2026-05-15T12:00:00');
    d.setDate(d.getDate() - i);
    // mostly 0–1 sales/day with occasional bursts
    const r = RNG();
    const count = r < 0.75 ? 0 : r < 0.93 ? 1 : r < 0.99 ? 2 : 3;
    out.push({ date: d, count });
  }
  return out;
})();

const AVG_DAYS_IN_STOCK = (() => {
  const sold = PRODUCTS.filter(p => p.status === 'sold' && p.soldAt);
  if (!sold.length) return 47; // fallback
  const total = sold.reduce((a, p) => a + (p.soldAt - p.created) / 86400000, 0);
  return Math.round(total / sold.length);
})();

const STOCK_BY_LINE = LINES.map(l => ({
  ...l,
  count: PRODUCTS.filter(p => p.line === l.slug && p.status === 'available').length,
})).filter(x => x.count > 0).sort((a, b) => b.count - a.count);

const MISSING = {
  photos: PRODUCTS.filter(p => !p.hasPhoto && p.status !== 'sold'),
  desc:   PRODUCTS.filter(p => !p.hasDesc && p.status !== 'sold' && p.status !== 'draft'),
  price:  PRODUCTS.filter(p => p.price === 0 && p.status !== 'sold'),
};

// Proposals — 9 pending across 6 products
const PROPOSALS = [
  {
    id: 'pp-1',
    productSlug: 'gemini-kanon',
    productName: 'Gemini Kanon',
    productLine: 'Saint Cloth Myth EX',
    status: 'new',
    receivedAt: new Date('2026-05-14T22:14:00'),
    fieldCount: 3,
    imageCount: 4,
    sources: ['tamashii', 'ebay'],
    avgConfidence: 92,
    fields: [
      { key: 'description', source: 'tamashii', confidence: 95,
        current: 'Edición exclusiva de Tamashii Web Shop. Lanzamiento: mayo 2022.',
        proposed: 'Edición exclusiva de Tamashii Web Shop. Lanzamiento: noviembre 2017.' },
      { key: 'price', source: 'ebay', confidence: 85,
        current: '220', proposed: '195',
        note: 'min $150 · median $195 · max $280 across 11 NEW listings (eBay Browse API)' },
      { key: 'release_year', source: 'tamashii', confidence: 95,
        current: '2022', proposed: '2017' },
    ],
    images: 4,
  },
  {
    id: 'pp-2',
    productSlug: 'babel-de-centaurus',
    productName: 'Babel de Centaurus',
    productLine: 'Saint Cloth Myth',
    status: 'new',
    receivedAt: new Date('2026-05-13T15:02:00'),
    fieldCount: 2,
    imageCount: 0,
    sources: ['ebay'],
    avgConfidence: 78,
    fields: [
      { key: 'price', source: 'ebay', confidence: 82,
        current: '200', proposed: '215',
        note: 'min $180 · median $215 · max $250 across 6 listings' },
      { key: 'condition', source: 'ebay', confidence: 74,
        current: 'mint_sealed', proposed: 'mint_open',
        note: 'Most active listings note box opened — verify before changing' },
    ],
  },
  {
    id: 'pp-3',
    productSlug: 'super-saiyan-vegeta-awakening',
    productName: 'Super Saiyan Vegeta (Awakening Super Saiyan Blood)',
    productLine: 'S.H.Figuarts',
    status: 'in-review',
    receivedAt: new Date('2026-05-12T09:41:00'),
    fieldCount: 1,
    imageCount: 2,
    sources: ['tamashii'],
    avgConfidence: 96,
    fields: [
      { key: 'description', source: 'tamashii', confidence: 96,
        current: '', proposed: 'Edición Tamashii Web Shop, lanzamiento agosto 2019.' },
    ],
  },
  {
    id: 'pp-4',
    productSlug: 'sukuna-figuarts-zero',
    productName: 'Sukuna',
    productLine: 'Figuarts Zero',
    status: 'new',
    receivedAt: new Date('2026-05-12T18:30:00'),
    fieldCount: 4,
    imageCount: 3,
    sources: ['tamashii', 'ebay'],
    avgConfidence: 71,
    fields: [
      { key: 'price', source: 'ebay', confidence: 68, current: '140', proposed: '125' },
      { key: 'description', source: 'tamashii', confidence: 92, current: '', proposed: 'Lanzamiento: enero 2024.' },
      { key: 'release_year', source: 'tamashii', confidence: 88, current: '', proposed: '2024' },
      { key: 'sku', source: 'tamashii', confidence: 36, current: '', proposed: 'BAS65498' },
    ],
  },
  {
    id: 'pp-5',
    productSlug: 'moses-de-whale',
    productName: 'Moses de Whale',
    productLine: 'Saint Cloth Myth',
    status: 'new',
    receivedAt: new Date('2026-05-11T11:22:00'),
    fieldCount: 1,
    imageCount: 5,
    sources: ['ebay'],
    avgConfidence: 81,
    fields: [
      { key: 'price', source: 'ebay', confidence: 81, current: '240', proposed: '260',
        note: 'min $220 · median $260 · max $310 across 8 listings' },
    ],
  },
  {
    id: 'pp-6',
    productSlug: 'metal-cooler',
    productName: 'Metal Cooler',
    productLine: 'S.H.Figuarts',
    status: 'new',
    receivedAt: new Date('2026-05-10T08:00:00'),
    fieldCount: 2,
    imageCount: 1,
    sources: ['tamashii'],
    avgConfidence: 89,
    fields: [
      { key: 'description', source: 'tamashii', confidence: 91, current: 'Cooler en su forma final.', proposed: 'Cooler en su forma Metal Cooler. Tamashii Nations, julio 2022.' },
      { key: 'release_year', source: 'tamashii', confidence: 87, current: '2021', proposed: '2022' },
    ],
  },
];

const RECENT_SOLD = PRODUCTS
  .filter(p => p.status === 'sold')
  .sort((a, b) => b.soldAt - a.soldAt)
  .slice(0, 5);

const RECENT_RESERVED = PRODUCTS
  .filter(p => p.status === 'reserved')
  .sort((a, b) => b.reservedAt - a.reservedAt)
  .slice(0, 6);

const RECENT_ADDED = [...PRODUCTS]
  .sort((a, b) => b.created - a.created)
  .slice(0, 6);

const BRANDS = [
  { name: 'Tamashii Nations', slug: 'tamashii-nations' },
  { name: 'Good Smile Company', slug: 'good-smile' },
  { name: 'MegaHouse', slug: 'megahouse' },
  { name: 'Otros', slug: 'varios' },
];

const SERIES_DATA = [
  { name: 'Dragon Ball Z', slug: 'dragon-ball-z', line: 'S.H.Figuarts' },
  { name: 'Marvel', slug: 'marvel', line: 'S.H.Figuarts' },
  { name: 'Berserk', slug: 'berserk', line: 'S.H.Figuarts' },
  { name: 'Bleach', slug: 'bleach', line: 'S.H.Figuarts' },
  { name: 'Spy × Family', slug: 'spy-family', line: 'S.H.Figuarts' },
  { name: 'Dragon Ball Super', slug: 'dragon-ball-super', line: 'S.H.Figuarts' },
  { name: 'Saint Seiya', slug: 'saint-seiya', line: 'Saint Cloth Myth EX' },
  { name: 'Dragon Ball', slug: 'dragon-ball', line: 'S.H.Figuarts' },
  { name: 'Chainsaw Man', slug: 'chainsaw-man', line: 'Pop Up Parade' },
  { name: 'Demon Slayer', slug: 'demon-slayer', line: 'Pop Up Parade' },
  { name: 'Jujutsu Kaisen', slug: 'jujutsu-kaisen', line: 'Pop Up Parade' },
];

Object.assign(window, {
  LINES, SERIES, STATUSES, CONDITIONS, PRODUCTS, COUNTERS, INVENTORY_VALUE,
  SALES_HISTORY, AVG_DAYS_IN_STOCK, STOCK_BY_LINE, MISSING, PROPOSALS,
  RECENT_SOLD, RECENT_RESERVED, RECENT_ADDED, BRANDS, SERIES_DATA,
});
