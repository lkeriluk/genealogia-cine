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

function calcMet(film, diffs, max) {
  max = max || 3;
  if (!diffs.length || !film.ratings) return null;
  const normalized = diffs.map(d => {
    const val = film.ratings[d.id];
    if (val === undefined) return undefined;
    // if activeRatings exists, only count diffs explicitly marked true
    if (film.activeRatings && film.activeRatings[d.id] !== true) return undefined;
    return Math.abs(val) / max;
  }).filter(v => v !== undefined);
  if (!normalized.length) return null;
  return +(normalized.reduce((s, v) => s + v, 0) / normalized.length * 3).toFixed(2);
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
  };
}
