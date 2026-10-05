// Pure calculation functions — no DOM, no global state, no TMDB calls.
// Loaded as <script src="/lib/logic.js"> in the browser (globals) and
// required via CommonJS in Node/Jest tests.

function minSampleForTarget(univCounts, target) {
  const total = univCounts.reduce((s, v) => s + v, 0);
  if (!total) return 1;
  const props = univCounts.map(v => v / total);
  for (let N = 5; N <= 2000; N++) {
    const sampleCounts = props.map(p => Math.round(p * N));
    const sampleTotal = sampleCounts.reduce((s, v) => s + v, 0) || 1;
    const overlap = props.reduce((s, p, i) => s + Math.min(p, sampleCounts[i] / sampleTotal), 0);
    if (overlap >= target) return N;
  }
  return 2000;
}

function calculateMinSample(f) {
  if (!f.cache) return 30;
  const target = 0.95;
  const candidates = [];
  if (f.cache.decadesCounts && f.cache.decadesCounts.length)
    candidates.push(minSampleForTarget(f.cache.decadesCounts, target));
  if (f.cache.ratingBuckets && f.cache.ratingBuckets.length)
    candidates.push(minSampleForTarget(f.cache.ratingBuckets, target));
  if (f.cache.voteBuckets && f.cache.voteBuckets.length)
    candidates.push(minSampleForTarget(f.cache.voteBuckets, target));
  if (f.cache.genreTop10 && f.cache.genreTop10.length)
    candidates.push(minSampleForTarget(f.cache.genreTop10.map(x => x[1]), target));
  if ((!f.countries || !f.countries.length) && f.cache.countryTop10 && f.cache.countryTop10.length)
    candidates.push(minSampleForTarget(f.cache.countryTop10.map(x => x[1]), target));
  // Each active decade needs at least 10 movies so fetchDecade uses ≥5 spread pages.
  const activeDecades = (f.cache.decadesCounts || []).filter(c => c > 0).length || 1;
  const decadeFloor = activeDecades * 10;
  const raw = candidates.length ? Math.max(...candidates) : 30;
  return Math.min(Math.max(raw, decadeFloor), Math.round((f.universeTotal || raw) * 0.8));
}

function l1Overlap(a, b) {
  const sumA = a.reduce((s, v) => s + v, 0);
  const sumB = b.reduce((s, v) => s + v, 0);
  if (sumA === 0 || sumB === 0) return 0;
  return a.reduce((s, v, i) => s + Math.min(v / sumA, b[i] / sumB), 0);
}

function cosineSimilarity(a, b) {
  if (!a.length || a.length !== b.length) return 0;
  const dot  = a.reduce((s, v, i) => s + v * b[i], 0);
  const magA = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
  const magB = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
  if (magA === 0 || magB === 0) return 0;
  return Math.max(0, Math.min(1, dot / (magA * magB)));
}

function calculateRepIndex(f) {
  if (!f.sample || !f.sample.length) return 0;
  const decades = [];
  for (let d = f.decFrom; d <= f.decTo; d += 10) decades.push(d);
  const univCounts = f.cache && f.cache.decadesCounts && f.cache.decadesCounts.length
    ? f.cache.decadesCounts
    : decades.map(() => 1); // fallback uniforme si no hay cache
  const sampleCounts = decades.map(d => f.sample.filter(m => Math.floor(m.year / 10) * 10 === d).length);
  const sizeFactor = Math.min(1, f.sample.length / (f.minSuggested || 1));
  return +( l1Overlap(univCounts, sampleCounts) * sizeFactor ).toFixed(2);
}

function calcMet(film, diffs) {
  if (!diffs.length || !film.ratings) return null;
  const normalized = diffs.map(d => {
    const val = film.ratings[d.id];
    if (val === undefined) return undefined;
    // if activeRatings exists, only count diffs explicitly marked true
    if (film.activeRatings && film.activeRatings[d.id] !== true) return undefined;
    return Math.abs(val);
  }).filter(v => v !== undefined);
  if (!normalized.length) return null;
  return +(normalized.reduce((s, v) => s + v, 0) / normalized.length).toFixed(2);
}

function calClassify(m, totalDiffs) {
  const rated = Object.keys(m.ratings || {}).length;
  if (totalDiffs === 0 || rated === 0) return 'pending';
  if (rated >= totalDiffs) return 'done';
  return 'inProgress';
}

function fmtRevenue(r) {
  if (!r) return '—';
  if (r >= 1e9) return '$' + (r / 1e9).toFixed(1) + 'B';
  return '$' + Math.round(r / 1e6) + 'M';
}

// Pares de diferenciales relacionados en una película, como índices [i, j] con i < j, sin duplicados
function relationPairs(film, diffs, relKey) {
  const rel = film[relKey || 'calRelations'] || {};
  const idx = {};
  diffs.forEach((d, i) => { idx[d.id] = i; });
  const seen = {}, pairs = [];
  Object.keys(rel).forEach(a => {
    (rel[a] || []).forEach(b => {
      const i = idx[a], j = idx[b];
      if (i === undefined || j === undefined || i === j) return;
      const lo = Math.min(i, j), hi = Math.max(i, j), key = lo + '-' + hi;
      if (seen[key]) return;
      seen[key] = true;
      pairs.push([lo, hi]);
    });
  });
  return pairs;
}

// Orden por afinidad: agrupamiento jerárquico (enlace promedio) que deja contiguos
// los diferenciales que más se relacionan entre sí
function affinityOrder(indices, counts) {
  let cl = indices.map(i => [i]);
  const avg = (x, y) => { let s = 0; x.forEach(a => y.forEach(b => { s += counts[a][b]; })); return s / (x.length * y.length); };
  while (cl.length > 1) {
    let bi = 0, bj = 1, best = -1;
    for (let i = 0; i < cl.length; i++) for (let j = i + 1; j < cl.length; j++) {
      const v = avg(cl[i], cl[j]);
      if (v > best) { best = v; bi = i; bj = j; }
    }
    const x = cl[bi], y = cl[bj], rx = x.slice().reverse(), ry = y.slice().reverse();
    let bo = null, bs = -1;
    [[x, y], [x, ry], [rx, y], [rx, ry]].forEach(o => {
      const sc = counts[o[0][o[0].length - 1]][o[1][0]];
      if (sc > bs) { bs = sc; bo = o; }
    });
    cl = cl.filter((_, k) => k !== bi && k !== bj);
    cl.push(bo[0].concat(bo[1]));
  }
  return cl[0] || [];
}

// Relaciones entre diferenciales agregadas sobre un conjunto de películas.
// Solo cuentan las películas con al menos una relación; hiddenIds excluye diferenciales de pares y strength.
function calcRelationStats(films, diffs, hiddenIds, relKey) {
  const hidden = hiddenIds || [];
  const nd = diffs.length;
  const base = [];
  films.forEach(film => {
    const pairs = relationPairs(film, diffs, relKey);
    if (pairs.length) base.push({ film, pairs });
  });
  const counts = Array.from({ length: nd }, () => new Array(nd).fill(0));
  base.forEach(b => b.pairs.forEach(([i, j]) => { counts[i][j]++; counts[j][i]++; }));
  const sign = diffs.map(d => {
    const s = { pos: 0, neg: 0, zero: 0, na: 0 };
    base.forEach(({ film }) => {
      const raw = (film.ratings || {})[d.id];
      const inactive = film.activeRatings && film.activeRatings[d.id] !== true;
      if (raw === undefined || raw === null || inactive) s.na++;
      else if (+raw > 0) s.pos++;
      else if (+raw < 0) s.neg++;
      else s.zero++;
    });
    return s;
  });
  const visible = diffs.map((_, i) => i).filter(i => hidden.indexOf(diffs[i].id) === -1);
  const strength = diffs.map((_, i) => visible.reduce((s, j) => s + (j === i ? 0 : counts[i][j]), 0));
  const n = base.length;
  const pairs = [];
  for (let x = 0; x < visible.length; x++) for (let y = x + 1; y < visible.length; y++) {
    const a = visible[x], b = visible[y];
    if (counts[a][b] > 0) pairs.push({ a, b, n: counts[a][b], pct: counts[a][b] / n });
  }
  pairs.sort((p, q) => q.n - p.n);
  return { base, n, counts, sign, visible, strength, pairs };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    minSampleForTarget,
    calculateMinSample,
    l1Overlap,
    cosineSimilarity,
    calculateRepIndex,
    calcMet,
    calClassify,
    fmtRevenue,
    relationPairs,
    affinityOrder,
    calcRelationStats,
  };
}
