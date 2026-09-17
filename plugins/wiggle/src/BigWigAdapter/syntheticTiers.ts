import type { RawFeatureArrays } from '../util.ts'
import type { BigWig, BigWigHeaderWithRefNames } from '@gmod/bbi'
import type { openLocation } from '@jbrowse/core/util/io'

export interface BigWigRegionArrays extends RawFeatureArrays {
  starts: Int32Array
  ends: Int32Array
}

// Two, because a writer puts a file's first level at 10-40x its data's record
// spacing (UCSC starts at 10x the mean span and quarters until a level halves
// the data), so under the second synthetic tier's floor the raw section already
// holds about a feature a pixel. A third tier would sit at or under the data's
// own resolution, where binning only costs a refetch.
const SYNTHETIC_TIER_COUNT = 2

const MIN_SYNTHETIC_BIN_BP = 2

const CIR_TREE_MAGIC = 0x2468ace0

const SAMPLE_MIN_RECORDS = 256

/**
 * The bins a file's synthetic tiers can hold, finest first, before
 * `syntheticReductionLevels` weighs them against the data. Powers of two a
 * factor of 4 apart like bbi's own levels, the coarsest the smallest at or
 * above a quarter of the first level: under `tierSpanRange` a bin of `b` then
 * serves `[b/2, next/2)`, so a synthetic tier holds at most two features a
 * pixel, as a real one does. None under `MIN_SYNTHETIC_BIN_BP`, and none for a
 * file with no zoom levels.
 */
export function syntheticCandidateLevels(reductionLevels: readonly number[]) {
  const levels: number[] = []
  if (reductionLevels.length === 0) {
    return levels
  }
  let bin = 2 ** Math.ceil(Math.log2(Math.min(...reductionLevels) / 4))
  for (
    let i = 0;
    i < SYNTHETIC_TIER_COUNT && bin >= MIN_SYNTHETIC_BIN_BP;
    i++
  ) {
    levels.unshift(bin)
    bin /= 4
  }
  return levels
}

/**
 * The bin widths the adapter serves between the raw section and a file's first
 * zoom level, finest first: the candidates at or above twice the raw section's
 * mean record span. Binning halves the rows only where a bin holds two records
 * on average, so a finer bin is dropped and its zooms read raw records. A
 * file with no measurable span (NaN) gets none.
 */
export function syntheticReductionLevels(
  reductionLevels: readonly number[],
  meanRecordSpan: number,
) {
  return syntheticCandidateLevels(reductionLevels).filter(
    bin => bin >= 2 * meanRecordSpan,
  )
}

interface SampleSource {
  bigwig: BigWig
  filehandle: Pick<ReturnType<typeof openLocation>, 'read'>
  header: BigWigHeaderWithRefNames
  firstLevel: number
}

/**
 * The raw section's mean record span, off a sample fixed by the file: the
 * records from where its raw index says the data starts, over 64 first-level
 * widths, or 1024 when that holds under 256 records. The header has no record
 * count to divide `basesCovered` by — a BigWig's `dataCount` counts sections —
 * so a file-level number has to come from records. NaN where the sample finds
 * none.
 */
export async function sampleMeanRecordSpan(
  { bigwig, filehandle, header, firstLevel }: SampleSource,
  opts: { signal?: AbortSignal } = {},
) {
  const index = await filehandle.read(48, header.unzoomedIndexOffset, opts)
  const view = new DataView(index.buffer, index.byteOffset, index.byteLength)
  const refName =
    index.byteLength === 48 && view.getUint32(0, true) === CIR_TREE_MAGIC
      ? header.refsByNumber[view.getUint32(16, true)]?.name
      : undefined
  if (refName === undefined) {
    return Number.NaN
  }
  const start = view.getUint32(20, true)
  let records = 0
  let bases = 0
  for (const widths of [64, 1024]) {
    const { starts, ends } = await bigwig.getFeaturesAsArrays(
      refName,
      start,
      start + widths * firstLevel,
      { ...opts, basesPerSpan: firstLevel / 4 },
    )
    records = starts.length
    bases = 0
    for (let i = 0; i < records; i++) {
      bases += ends[i]! - starts[i]!
    }
    if (records >= SAMPLE_MIN_RECORDS) {
      break
    }
  }
  return bases / records
}

/**
 * The bin a fetch aggregates raw records into: the picked level's reduction
 * (`2 * lo` off `tierSpanRange`), when that level is synthetic.
 */
export function syntheticBinBp(tierLo: number, firstLevel: number) {
  const reduction = tierLo * 2
  return reduction > 0 && reduction < firstLevel ? reduction : undefined
}

/**
 * The fetch extent whose records decide every bin `[start, end)` touches, so
 * an edge bin's value doesn't depend on where the region happens to start.
 */
export function binAlignedExtent(start: number, end: number, binBp: number) {
  return {
    start: Math.max(0, Math.floor(start / binBp) * binBp),
    end: Math.ceil(end / binBp) * binBp,
  }
}

function rawSlice(
  starts: Int32Array,
  ends: Int32Array,
  scores: Float32Array,
  lo: number,
  hi: number,
): BigWigRegionArrays {
  return {
    starts: starts.subarray(lo, hi),
    ends: ends.subarray(lo, hi),
    scores: scores.subarray(lo, hi),
    minScores: undefined,
    maxScores: undefined,
    count: hi - lo,
  }
}

/**
 * Raw records `[lo, hi)`, fetched over `binAlignedExtent(regionStart,
 * regionEnd, binBp)`, as bbi-style summary rows over absolute `binBp` bins.
 *
 * A bin's score is the mean over the bases its records cover, each record
 * weighted by the bases it overlaps the bin with, so a record crossing a
 * boundary counts in both bins and sparse data isn't diluted by empty bases;
 * min and max are over those records. A row spans the bases its bin covers,
 * not the whole bin, so a bin holding one record reproduces that record, and a
 * bin with no data (or only NaN) emits nothing. Adjacent rows with identical
 * mean, min and max merge, which keeps a long record one row.
 *
 * The region's raw records come back instead, with no min/max, only when the
 * records overlap or run out of order, which a BigWig's raw section forbids.
 * Whether a zoom bins at all is the file's call (`syntheticReductionLevels`),
 * never the region's, so a locus reads the same at a zoom however it is
 * fetched.
 */
export function binRawRegion(
  starts: Int32Array,
  ends: Int32Array,
  scores: Float32Array,
  lo: number,
  hi: number,
  regionStart: number,
  regionEnd: number,
  binBp: number,
): BigWigRegionArrays {
  let rawLo = lo
  while (rawLo < hi && ends[rawLo]! <= regionStart) {
    rawLo++
  }
  let rawHi = hi
  while (rawHi > rawLo && starts[rawHi - 1]! >= regionEnd) {
    rawHi--
  }
  const { start: extentStart, end: extentEnd } = binAlignedExtent(
    regionStart,
    regionEnd,
    binBp,
  )
  // A record adds at most three rows: its start bin, a run of whole bins, and
  // the bin its tail shares with the next record
  const capacity = Math.min(3 * (hi - lo), (extentEnd - extentStart) / binBp)
  if (capacity <= 0) {
    return rawSlice(starts, ends, scores, rawLo, rawHi)
  }

  const positions = new Int32Array(capacity * 2)
  const values = new Float32Array(capacity * 3)
  const outStarts = positions.subarray(0, capacity)
  const outEnds = positions.subarray(capacity)
  const outMeans = values.subarray(0, capacity)
  const outMins = values.subarray(capacity, capacity * 2)
  const outMaxs = values.subarray(capacity * 2)

  function emit(
    n: number,
    s: number,
    e: number,
    sum: number,
    covered: number,
    min: number,
    max: number,
  ) {
    const avg = sum / covered
    const mean = Math.fround(
      min === max ? min : avg < min ? min : avg > max ? max : avg,
    )
    const last = n - 1
    if (
      last >= 0 &&
      outEnds[last] === s &&
      outMeans[last] === mean &&
      outMins[last] === min &&
      outMaxs[last] === max
    ) {
      outEnds[last] = e
      return n
    }
    if (n === capacity) {
      return -1
    }
    outStarts[n] = s
    outEnds[n] = e
    outMeans[n] = mean
    outMins[n] = min
    outMaxs[n] = max
    return n + 1
  }

  let n = 0
  let windowEnd = -1
  let sum = 0
  let covered = 0
  let min = 0
  let max = 0
  let coveredStart = 0
  let coveredEnd = 0
  let previousEnd = -Infinity
  for (let i = lo; i < hi; i++) {
    const score = scores[i]!
    if (score !== score) {
      continue
    }
    const recordStart = starts[i]!
    if (recordStart < previousEnd) {
      return rawSlice(starts, ends, scores, rawLo, rawHi)
    }
    previousEnd = ends[i]!
    let s = recordStart > extentStart ? recordStart : extentStart
    const e = previousEnd < extentEnd ? previousEnd : extentEnd
    while (s < e) {
      if (s >= windowEnd) {
        if (windowEnd >= 0) {
          n = emit(n, coveredStart, coveredEnd, sum, covered, min, max)
          if (n < 0) {
            return rawSlice(starts, ends, scores, rawLo, rawHi)
          }
        }
        const bin = s - (s % binBp)
        windowEnd =
          s === bin && e - bin >= binBp ? e - ((e - bin) % binBp) : bin + binBp
        sum = 0
        covered = 0
        min = score
        max = score
        coveredStart = s
      }
      const segmentEnd = e < windowEnd ? e : windowEnd
      const bases = segmentEnd - s
      sum += score * bases
      covered += bases
      if (score < min) {
        min = score
      } else if (score > max) {
        max = score
      }
      coveredEnd = segmentEnd
      s = segmentEnd
    }
  }
  if (windowEnd >= 0) {
    n = emit(n, coveredStart, coveredEnd, sum, covered, min, max)
    if (n < 0) {
      return rawSlice(starts, ends, scores, rawLo, rawHi)
    }
  }

  return {
    starts: outStarts.subarray(0, n),
    ends: outEnds.subarray(0, n),
    scores: outMeans.subarray(0, n),
    minScores: outMins.subarray(0, n),
    maxScores: outMaxs.subarray(0, n),
    count: n,
  }
}
