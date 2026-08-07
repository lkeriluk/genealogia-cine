'use strict';

const {
  minSampleForTarget,
  calculateMinSample,
  l1Overlap,
  cosineSimilarity,
  calculateRepIndex,
  calcMet,
  calClassify,
  fmtRevenue,
} = require('../lib/logic');

// ── minSampleForTarget ──────────────────────────────────────────────────────

describe('minSampleForTarget', () => {
  test('returns 1 for empty counts', () => {
    expect(minSampleForTarget([], 0.95)).toBe(1);
    expect(minSampleForTarget([0, 0], 0.95)).toBe(1);
  });

  test('uniform distribution requires small N', () => {
    // 4 equal buckets — a small sample already covers all proportionally
    const n = minSampleForTarget([25, 25, 25, 25], 0.95);
    expect(n).toBeGreaterThanOrEqual(5);
    expect(n).toBeLessThan(100);
  });

  test('dominant bucket satisfies target at minimum N', () => {
    // 1 bucket with 99%+ → overlap already ≥ 0.95 at N=5
    const skewed = [1000, 1, 1, 1, 1, 1, 1, 1, 1, 1];
    expect(minSampleForTarget(skewed, 0.95)).toBe(5);
  });

  test('uniform distribution with many buckets requires more N than single bucket', () => {
    const single   = minSampleForTarget([100], 0.95);
    const tenEqual = minSampleForTarget([10, 10, 10, 10, 10, 10, 10, 10, 10, 10], 0.95);
    expect(tenEqual).toBeGreaterThanOrEqual(single);
  });

  test('single bucket always satisfies at N=5', () => {
    expect(minSampleForTarget([100], 0.95)).toBe(5);
  });

  test('result is never greater than 2000', () => {
    // 2000 is the hard cap regardless of distribution
    const counts = new Array(500).fill(1);
    expect(minSampleForTarget(counts, 0.99)).toBeLessThanOrEqual(2000);
  });
});

// ── calculateMinSample ──────────────────────────────────────────────────────

describe('calculateMinSample', () => {
  test('returns 30 when cache is missing', () => {
    expect(calculateMinSample({})).toBe(30);
    expect(calculateMinSample({ cache: null })).toBe(30);
  });

  test('returns decadeFloor when no cache arrays', () => {
    const f = {
      cache: { decadesCounts: [100, 100, 100] }, // 3 active decades → floor 30
      universeTotal: 10000,
    };
    const n = calculateMinSample(f);
    expect(n).toBeGreaterThanOrEqual(30);
  });

  test('does not exceed 80% of universeTotal', () => {
    const f = {
      cache: { decadesCounts: new Array(20).fill(50) }, // 20 active decades → floor 200
      universeTotal: 100,
    };
    expect(calculateMinSample(f)).toBeLessThanOrEqual(80);
  });

  test('excludes countryTop10 when countries filter is active', () => {
    const bigCountryDistrib = new Array(50).fill(10); // would push N high
    const fFiltered = {
      countries: ['US'],
      cache: {
        decadesCounts: [100, 100],
        countryTop10: bigCountryDistrib.map((v, i) => [`c${i}`, v]),
      },
      universeTotal: 10000,
    };
    const fAll = {
      countries: [],
      cache: {
        decadesCounts: [100, 100],
        countryTop10: bigCountryDistrib.map((v, i) => [`c${i}`, v]),
      },
      universeTotal: 10000,
    };
    // With country filter active, countryTop10 should be ignored → smaller N
    expect(calculateMinSample(fFiltered)).toBeLessThan(calculateMinSample(fAll));
  });
});

// ── l1Overlap ───────────────────────────────────────────────────────────────

describe('l1Overlap', () => {
  test('identical distributions → 1', () => {
    expect(l1Overlap([3, 3, 3], [3, 3, 3])).toBeCloseTo(1);
    expect(l1Overlap([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
  });

  test('completely disjoint distributions → 0', () => {
    expect(l1Overlap([1, 0], [0, 1])).toBeCloseTo(0);
  });

  test('zero sum → 0', () => {
    expect(l1Overlap([0, 0], [1, 2])).toBe(0);
    expect(l1Overlap([1, 2], [0, 0])).toBe(0);
  });

  test('partial overlap is between 0 and 1', () => {
    const v = l1Overlap([3, 1], [1, 3]);
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThan(1);
  });
});

// ── cosineSimilarity ────────────────────────────────────────────────────────

describe('cosineSimilarity', () => {
  test('identical vectors → 1', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
  });

  test('orthogonal vectors → 0', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  test('empty or mismatched lengths → 0', () => {
    expect(cosineSimilarity([], [])).toBe(0);
    expect(cosineSimilarity([1, 2], [1])).toBe(0);
  });

  test('zero vector → 0', () => {
    expect(cosineSimilarity([0, 0], [1, 2])).toBe(0);
  });

  test('result is clamped to [0, 1]', () => {
    const v = cosineSimilarity([1, 2, 3], [4, 5, 6]);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(1);
  });
});

// ── calculateRepIndex ───────────────────────────────────────────────────────

describe('calculateRepIndex', () => {
  test('empty sample → 0', () => {
    expect(calculateRepIndex({ sample: [], decFrom: 1980, decTo: 2020 })).toBe(0);
    expect(calculateRepIndex({ decFrom: 1980, decTo: 2020 })).toBe(0);
  });

  test('muestra al mínimo sugerido, distribución perfecta → 1', () => {
    // n = minSuggested → sizeFactor = 1, l1Overlap = 1 → resultado = 1
    const sample = [
      { year: 1982 }, { year: 1985 },
      { year: 1993 }, { year: 1997 },
      { year: 2003 }, { year: 2006 },
      { year: 2012 }, { year: 2015 },
      { year: 2021 }, { year: 2024 },
    ];
    const cache = { decadesCounts: [100, 100, 100, 100, 100] };
    const v = calculateRepIndex({ sample, decFrom: 1980, decTo: 2020, cache, minSuggested: 10 });
    expect(v).toBeCloseTo(1);
  });

  test('1 película, minSuggested = 50 → índice muy bajo', () => {
    const sample = [{ year: 2015 }];
    const cache = { decadesCounts: Array(11).fill(100) };
    // l1Overlap ≈ 1/11, sizeFactor = 1/50 → resultado ≈ 0.002
    const v = calculateRepIndex({ sample, decFrom: 1920, decTo: 2020, cache, minSuggested: 50 });
    expect(v).toBeLessThan(0.05);
  });

  test('muestra sobre el mínimo sugerido no tiene penalización extra', () => {
    // n = 20, minSuggested = 10 → sizeFactor = min(1, 2) = 1
    const sample = Array.from({ length: 20 }, (_, i) => ({ year: 1980 + i }));
    const cache = { decadesCounts: [100, 100] };
    const v = calculateRepIndex({ sample, decFrom: 1980, decTo: 1990, cache, minSuggested: 10 });
    expect(v).toBeCloseTo(1);
  });

  test('sin cache usa distribución uniforme como fallback', () => {
    const sample = [{ year: 2000 }];
    const v = calculateRepIndex({ sample, decFrom: 2000, decTo: 2000, minSuggested: 1 });
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(1);
  });
});

// ── calcMet ─────────────────────────────────────────────────────────────────

describe('calcMet', () => {
  const d1 = { id: 'd1' };
  const d2 = { id: 'd2' };

  test('no diffs → null', () => {
    expect(calcMet({ ratings: { d1: 2 } }, [])).toBeNull();
  });

  test('no ratings → null', () => {
    expect(calcMet({}, [d1])).toBeNull();
    expect(calcMet({ ratings: null }, [d1])).toBeNull();
  });

  test('all ratings at max absolute value → 3.00', () => {
    expect(calcMet({ ratings: { d1: 3, d2: -3 } }, [d1, d2])).toBe(3.00);
  });

  test('all ratings at 0 → 0.00', () => {
    expect(calcMet({ ratings: { d1: 0, d2: 0 } }, [d1, d2])).toBe(0.00);
  });

  test('partial ratings (only d1 filled) → computed from d1 only', () => {
    // d1 = 3/3 * 3 = 3.00
    expect(calcMet({ ratings: { d1: 3 } }, [d1, d2])).toBe(3.00);
  });

  test('mixed values give correct average', () => {
    // d1: |3|/3 = 1, d2: |0|/3 = 0  → avg = 0.5 → * 3 = 1.50
    expect(calcMet({ ratings: { d1: 3, d2: 0 } }, [d1, d2])).toBe(1.50);
  });

  test('max param scales the result', () => {
    const dNeg = { id: 'dn' };
    // val = -2, max = 2 → |−2|/2 = 1 → * 3 = 3.00
    expect(calcMet({ ratings: { dn: -2 } }, [dNeg], 2)).toBe(3.00);
  });

  test('activeRatings: only active diffs count toward average', () => {
    // d1=3 active, d2=3 inactive → only d1 → 3.00
    expect(calcMet({ ratings: { d1: 3, d2: 3 }, activeRatings: { d1: true, d2: false } }, [d1, d2])).toBe(3.00);
  });

  test('activeRatings: all diffs deactivated → null', () => {
    expect(calcMet({ ratings: { d1: 3 }, activeRatings: { d1: false } }, [d1])).toBeNull();
  });

  test('activeRatings: zero value when active counts as 0.00', () => {
    expect(calcMet({ ratings: { d1: 0 }, activeRatings: { d1: true } }, [d1])).toBe(0.00);
  });

  test('activeRatings absent → legacy: all rated diffs count', () => {
    // no activeRatings key → same as before
    expect(calcMet({ ratings: { d1: 3, d2: 0 } }, [d1, d2])).toBe(1.50);
  });
});

// ── calClassify ─────────────────────────────────────────────────────────────

describe('calClassify', () => {
  test('no ratings → pending', () => {
    expect(calClassify({ ratings: {} }, 3)).toBe('pending');
    expect(calClassify({}, 3)).toBe('pending');
  });

  test('zero total diffs → pending', () => {
    expect(calClassify({ ratings: { d1: 1 } }, 0)).toBe('pending');
  });

  test('all diffs rated → done', () => {
    expect(calClassify({ ratings: { d1: 1, d2: 2, d3: 3 } }, 3)).toBe('done');
  });

  test('some diffs rated → inProgress', () => {
    expect(calClassify({ ratings: { d1: 1 } }, 3)).toBe('inProgress');
  });

  test('more ratings than diffs (extra keys) → done', () => {
    expect(calClassify({ ratings: { d1: 1, d2: 2, d3: 3, d4: 4 } }, 3)).toBe('done');
  });
});

// ── fmtRevenue ──────────────────────────────────────────────────────────────

describe('fmtRevenue', () => {
  test('falsy values → —', () => {
    expect(fmtRevenue(0)).toBe('—');
    expect(fmtRevenue(null)).toBe('—');
    expect(fmtRevenue(undefined)).toBe('—');
  });

  test('millions are rounded and prefixed $', () => {
    expect(fmtRevenue(150_000_000)).toBe('$150M');
    expect(fmtRevenue(1_500_000)).toBe('$2M');
  });

  test('billions use one decimal and B suffix', () => {
    expect(fmtRevenue(2_500_000_000)).toBe('$2.5B');
    expect(fmtRevenue(1_000_000_000)).toBe('$1.0B');
  });

  test('boundary 1B is formatted as B not M', () => {
    expect(fmtRevenue(1e9)).toBe('$1.0B');
  });
});
