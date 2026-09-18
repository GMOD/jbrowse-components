import { sum } from '@jbrowse/core/util'

// For a Gaussian, sd ≈ 1.4826·MAD, so a robust spread built from the MAD lines
// up with the classic ±Nσ thresholds on well-behaved data.
const MAD_TO_SD = 1.4826

// `Array.prototype.sort` needs a numeric comparator, and at the ~150k
// proper-pair inserts of a deep pileup its ~2.6M callback crossings dominate
// robustSpread (benched 4.5x end-to-end against this form). TypedArray#sort is
// comparator-free and numeric by definition. The copy keeps the caller's
// element type, so an integer-valued caller that hands in the Int32Array it
// already built (computePairedInsertSizeStats — |TLEN| is int32 in BAM) gets the
// integer sort, another ~2x over Float64Array, while a fractional one (arc
// radii, halved spans) stays exact. Float64Array holds any JS number exactly,
// so no caller loses precision to the copy.
function sortedCopy(values: ArrayLike<number>) {
  const copy =
    values instanceof Int32Array
      ? new Int32Array(values)
      : new Float64Array(values)
  copy.sort()
  return copy
}

function median(sorted: ArrayLike<number>) {
  const n = sorted.length
  const mid = n >> 1
  return n % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

// Median of |x − med| over an already-sorted array, in O(n) with no second
// allocation+sort. Walking outward from the median, deviations grow
// monotonically: the values below med (indices high→low) and those at/above med
// (indices low→high) form two ascending runs, so merging them and stopping at
// the middle yields the same value as sorting |x − med| — but ~2x cheaper at the
// high coverage where this matters (the naive form sorts twice). Matches
// `median()` semantics exactly (odd → middle element; even → mean of the two).
function medianAbsDevFromSorted(sorted: ArrayLike<number>, med: number) {
  const n = sorted.length
  let lo = 0
  while (lo < n && sorted[lo]! < med) {
    lo++
  }
  let i = lo - 1 // below-med run, walking toward index 0 (ascending deviation)
  let j = lo // at/above-med run, walking toward n-1 (ascending deviation)
  const target = n >> 1
  let prev = 0
  let cur = 0
  for (let k = 0; k <= target; k++) {
    prev = cur
    const leftDev = i >= 0 ? med - sorted[i]! : Infinity
    const rightDev = j < n ? sorted[j]! - med : Infinity
    if (leftDev <= rightDev) {
      cur = leftDev
      i--
    } else {
      cur = rightDev
      j++
    }
  }
  return n % 2 === 1 ? cur : (prev + cur) / 2
}

// The insert-size band used for coloring: the two thresholds that classify a
// read's |TLEN| as short/normal/long. This is the whole of getInsertSizeStats'
// output and the exact shape serialized across the worker boundary (see
// RenderAlignmentData PileupDataResult.insertSizeStats).
export interface InsertSizeBand {
  upper: number
  lower: number
}

export type InsertSizeClass = 'long' | 'short' | 'normal'

// Single home of the short/normal/long threshold rule, shared by the read-fill
// classifier (colorUtils.ts) and the arc/read-cloud classifier (arcs/arcColors.ts)
// so the two can't drift. `absInsert` is |TLEN|; 0 means unset (single-end /
// unpaired) and classifies as 'normal', never 'short' — otherwise an unpaired
// read in a mixed dataset (stats defined) would paint as a short insert. There
// is no GPU twin: read.slang consumes the resulting category and no longer
// applies thresholds of its own.
export function classifyInsertSize(
  absInsert: number,
  band: InsertSizeBand | undefined,
): InsertSizeClass {
  return band === undefined
    ? 'normal'
    : absInsert > band.upper
      ? 'long'
      : absInsert > 0 && absInsert < band.lower
        ? 'short'
        : 'normal'
}

// How far from the library's typical fragment an insert must sit before the
// band will call it short or long, as a MULTIPLE of that typical fragment. The
// statistical band is widened to at least this (`widenBandToEventScale`), never
// narrowed to it.
//
// The reason it exists is that ±3 robust SDs is a *relative* outlier test: it
// flags a roughly fixed fraction of the sample whatever the sample is, so the
// count of red arcs grows with coverage even where nothing biological changed.
// Measured on HG002 300x (`NHGRI_Illumina300X_AJtrio` novoalign, hs37d5), a
// 200 kb window at 1:2,000,000: 340,210 proper pairs, median 571, MAD 94, so
// the raw band's upper bound is 989 — and 3235 records (0.95%) paint
// long-insert. But the largest |TLEN| anywhere in that sample is 1141: the
// window holds no deletion at all, and 2625 of those 3235 — 81% — sit in
// 989..1142, which is the library's own right tail. The picture was one
// unreadable red wash over ordinary sequence.
//
// A ratio is the right shape for the floor because it says what the colour is
// supposed to MEAN — this pair implies an event comparable in size to the
// fragment itself — and because it is scale-free, so a 3 kb mate-pair library
// gets a 6 kb threshold from the same constant a 570 bp library gets 1142 from.
// The same window under the floor keeps 608 records, and those are the
// genuinely discordant ones (510 at 1142-2 kb, 2 past 2 kb, 96 with the mate on
// another contig).
//
// The cost is real and worth stating: a deletion shorter than about one
// fragment no longer separates from the tail by colour. At 341k inserts drawn
// from a distribution that stops at 1141 it was never separable — the tail was
// swamping it either way — but on a shallow pileup the raw band is tighter than
// this floor and, being a max/min, is what survives. So sensitivity is given up
// exactly where the depth had already taken it.
const LONG_INSERT_MIN_RATIO = 2
const SHORT_INSERT_MAX_RATIO = 0.5

export interface RobustSpread {
  center: number
  spread: number
}

// Degenerate-MAD fallback: mean ± numSds·sd, as a two-pass mean-subtracted
// variance (see robustSpread for why the single-pass form is unusable here).
function meanSpread(values: ArrayLike<number>, numSds: number): RobustSpread {
  const len = values.length
  const avg = sum(values) / len
  let sumSqDiff = 0
  for (let i = 0; i < len; i++) {
    const diff = values[i]! - avg
    sumSqDiff += diff * diff
  }
  return { center: avg, spread: numSds * Math.sqrt(sumSqDiff / len) }
}

// Robust center + spread of a sample: the median with a MAD-based spread
// (sd ≈ 1.4826·MAD), scaled by `numSds` (default 3 → the classic ±3σ band).
// Prefer this over mean ± Nσ for right-skewed data: insert-size distributions
// (and paired-end arc radii) have a long upper tail — deletions, large SVs —
// that inflates sd, driving the lower bound negative (nothing flagged "short")
// and the upper bound past genuine long-range signal. The MAD measures spread
// from the normal bulk and ignores that tail. When MAD = 0 (over half the values
// identical) the robust spread is degenerate, so fall back to mean/sd there.
//
// That fallback sd is a two-pass mean-subtracted variance. The single-pass
// sum-of-squares form (len*Σx² − (Σx)²)/len² is unstable at high coverage: both
// terms grow as O(len²·x̄²), overflow 2^53, and lose precision to catastrophic
// cancellation — a slightly-negative result then yields sd = NaN.
function robustSpread(values: ArrayLike<number>, numSds = 3): RobustSpread {
  const sorted = sortedCopy(values)
  const med = median(sorted)
  const mad = medianAbsDevFromSorted(sorted, med)
  return mad > 0
    ? { center: med, spread: numSds * MAD_TO_SD * mad }
    : meanSpread(values, numSds)
}

// Total over any non-empty sample; callers decide whether the resulting band is
// trustworthy enough to color from (see computePairedInsertSizeStats, which
// rejects a degenerate upper === lower band).
export function getInsertSizeStats(
  filtered: ArrayLike<number>,
): InsertSizeBand {
  const { center, spread } = robustSpread(filtered)
  return {
    upper: center + spread,
    lower: Math.max(0, center - spread),
  }
}

// Widen a raw statistical band out to the event scale — see
// LONG_INSERT_MIN_RATIO for why, and for the measurements.
//
// Deliberately NOT folded into `getInsertSizeStats`, which is the statistics and
// stays that: `robustSpread` also serves callers that want a spread rather than
// a colour rule, and the widening is a claim about what a colour should mean.
// Keeping it separate is also what preserves the degenerate-band signal — a
// sample with no spread returns `upper === lower`, which is
// `computePairedInsertSizeStats`' cue to colour nothing, and a floor applied
// before that check would hand it a wide band built on one distinct value.
//
// The centre is recovered as the band's own midpoint rather than threaded down
// from `robustSpread`, which is exact except where `lower` clamped at 0 — and
// there the clamp means the spread already reaches the origin, so the floor
// cannot bind on either side and the recovered centre is unused.
export function widenBandToEventScale(band: InsertSizeBand): InsertSizeBand {
  const center = (band.upper + band.lower) / 2
  return {
    upper: Math.max(band.upper, center * LONG_INSERT_MIN_RATIO),
    lower: Math.max(0, Math.min(band.lower, center * SHORT_INSERT_MAX_RATIO)),
  }
}
