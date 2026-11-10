import { binExtent, joinControl } from './joinControl.ts'
import { readPair, toHicRegion } from './readPair.ts'

import type { AxisMasks } from './joinControl.ts'
import type { PairRead, PairReadOptions } from './readPair.ts'
import type { Chromosome, HicFile, HicRegion } from '@gmod/hic'
import type { Region } from '@jbrowse/core/util/types'

/** One of the two files a comparison reads. */
export interface HicSide {
  hic: HicFile
  chromosomes: Chromosome[]
}

/**
 * The control's counts beside a pair's own, the two joined on bin pairs, and
 * each library's depth.
 */
export interface ControlCounts {
  counts: Float32Array
  depth: number
  controlDepth: number
  /** the contacts one served count stands for, in the map and the control */
  contactsPerCount: number
  controlContactsPerCount: number
}

export interface ControlledPairRead extends PairRead {
  control?: ControlCounts
}

// A bin is reportable where its normalization factor is usable; the parser
// drops a contact whose factor product is 0 or NaN.
const usable = (v: number | undefined) =>
  v !== undefined && v !== 0 && !Number.isNaN(v)

/**
 * The chromosome pair's contacts at this binsize, or undefined where the
 * file has no matrix for the pair there. The parser answers a missing matrix
 * with no records, which a join would read as all zeros.
 */
async function pairSum(
  { hic, chromosomes }: HicSide,
  chr1: string,
  chr2: string,
  resolution: number,
) {
  const c1 = chromosomes.find(c => c.name === chr1)
  const c2 = chromosomes.find(c => c.name === chr2)
  return c1 && c2
    ? (await hic.getMatrix(c1.index, c2.index))?.getZoomData(resolution)
        ?.sumCounts
    : undefined
}

const vectorMeans = new WeakMap<
  HicFile,
  Map<string, Promise<number | undefined>>
>()

// Not aborted with the fetch: a cached read cut short would answer every
// later fetch with its rejection. A read that fails leaves the cache.
function vectorMean(
  { hic, chromosomes }: HicSide,
  normalization: string,
  chr: string,
  resolution: number,
) {
  const means =
    vectorMeans.get(hic) ?? new Map<string, Promise<number | undefined>>()
  vectorMeans.set(hic, means)
  const key = `${normalization}\t${chr}\t${resolution}`
  const compute = async () => {
    const size = chromosomes.find(c => c.name === chr)?.size
    const vector = await hic.getNormalizationVector(
      normalization,
      chr,
      resolution,
    )
    const values =
      size === undefined
        ? undefined
        : await vector?.getValues(0, Math.ceil(size / resolution))
    let sum = 0
    let n = 0
    for (const v of values ?? []) {
      if (usable(v)) {
        sum += v
        n++
      }
    }
    return n > 0 ? sum / n : undefined
  }
  const mean =
    means.get(key) ??
    compute().catch((e: unknown) => {
      means.delete(key)
      throw e
    })
  means.set(key, mean)
  return mean
}

/**
 * The contacts one count of the chromosome pair stands for under
 * `normalization`: the product of its two vectors' means, since a count is
 * the raw one over `v[i] * v[j]`. Juicer's vectors keep the matrix total, so
 * this is near 1; a vector balancing each row to 1, as hictk copies from a
 * cooler, puts it in the thousands, where a pseudocount of 1 would swamp
 * every count.
 */
async function contactsPerCount(
  side: HicSide,
  normalization: string,
  chr1: string,
  chr2: string,
  resolution: number,
) {
  const [m1, m2] =
    normalization === 'NONE'
      ? [1, 1]
      : await Promise.all([
          vectorMean(side, normalization, chr1, resolution),
          vectorMean(side, normalization, chr2, resolution),
        ])
  return (m1 ?? 1) * (m2 ?? 1)
}

/** Which bins of `[start, end)` the file's `normalization` can report on. */
async function binMask(
  { hic }: HicSide,
  normalization: string,
  chr: string,
  [start, end]: readonly [number, number],
  resolution: number,
  signal?: AbortSignal,
) {
  const readValues = async () => {
    const vector = await hic.getNormalizationVector(
      normalization,
      chr,
      resolution,
      { signal },
    )
    return vector?.getValues(start, end, { signal })
  }
  const values = normalization === 'NONE' ? undefined : await readValues()
  return normalization === 'NONE'
    ? undefined
    : Uint8Array.from({ length: end - start }, (_, i) =>
        usable(values?.[i]) ? 1 : 0,
      )
}

interface PairQuery {
  mine: HicSide
  theirs: HicSide
  r1: HicRegion
  r2: HicRegion
  /** the control's names for `r1` and `r2` */
  c1: HicRegion
  c2: HicRegion
  mySum: number
  theirSum: number
  normalization: string
  resolution: number
  opts: PairReadOptions
}

/**
 * Both files' reads of one pair under one normalization: the two must carry
 * the same one for the ratio to mean anything, so a pair where they fell back
 * apart reads both raw.
 */
async function readBoth({
  mine,
  theirs,
  r1,
  r2,
  c1,
  c2,
  normalization,
  resolution,
  opts,
}: PairQuery) {
  const read = (norm: string) =>
    Promise.all([
      readPair(mine.hic, r1, r2, norm, resolution, opts),
      readPair(theirs.hic, c1, c2, norm, resolution, { signal: opts.signal }),
    ])
  const [a, b] = await read(normalization)
  return a && b && a.appliedNormalization !== b.appliedNormalization
    ? read('NONE')
    : ([a, b] as const)
}

async function joinPair(
  query: PairQuery,
  observed: PairRead,
  control: PairRead,
): Promise<ControlledPairRead> {
  const { mine, theirs, r1, r2, c1, c2, mySum, theirSum, resolution } = query
  const { signal } = query.opts
  const norm = observed.appliedNormalization
  const x = binExtent(observed.records.bin1, control.records.bin1)
  const y = binExtent(observed.records.bin2, control.records.bin2)
  const masksOf = async (
    side: HicSide,
    chr1: string,
    chr2: string,
  ): Promise<AxisMasks> => {
    const [xMask, yMask] = await Promise.all([
      binMask(side, norm, chr1, x, resolution, signal),
      binMask(side, norm, chr2, y, resolution, signal),
    ])
    return { x: xMask, y: yMask }
  }
  const [myTotal, theirTotal, myMasks, theirMasks, perCount, controlPerCount] =
    await Promise.all([
      mine.hic.getTotalContacts(),
      theirs.hic.getTotalContacts(),
      masksOf(mine, r1.chr, r2.chr),
      masksOf(theirs, c1.chr, c2.chr),
      contactsPerCount(mine, norm, r1.chr, r2.chr, resolution),
      contactsPerCount(theirs, norm, c1.chr, c2.chr, resolution),
    ])
  // Library totals only where both files have one: one file's total over
  // the other's pair sum would scale every cell by orders of magnitude.
  // A total below its own pair's sum is no total either: hictk writes the
  // `ALL` map's as 1. The pair sums keep a gain that spans a whole
  // chromosome pair, as a translocation's does, out of the depth.
  const [depth, controlDepth] =
    myTotal !== undefined &&
    theirTotal !== undefined &&
    myTotal >= mySum &&
    theirTotal >= theirSum
      ? [myTotal, theirTotal]
      : [mySum, theirSum]
  const joined = joinControl(observed.records, control.records, {
    observed: myMasks,
    control: theirMasks,
    x0: x[0],
    y0: y[0],
  })
  return {
    records: { bin1: joined.bin1, bin2: joined.bin2, counts: joined.counts },
    appliedNormalization: norm,
    control: {
      counts: joined.control,
      depth,
      controlDepth,
      contactsPerCount: perCount,
      controlContactsPerCount: controlPerCount,
    },
  }
}

/**
 * One region pair in both files, joined on bin pairs. A pair the control
 * holds no matrix for comes back as the map's alone, which the worker leaves
 * out, or paints as counts where no pair has a control.
 */
export async function readPairWithControl({
  mine,
  theirs,
  names,
  region1,
  region2,
  normalization,
  resolution,
  opts,
}: {
  mine: HicSide
  theirs: HicSide
  /** the control's name for each of the map's chromosomes it holds */
  names: Map<string, string>
  region1: Region
  region2: Region
  normalization: string
  resolution: number
  opts: PairReadOptions
}): Promise<ControlledPairRead | undefined> {
  const r1 = toHicRegion(region1)
  const r2 = toHicRegion(region2)
  const name1 = names.get(r1.chr)
  const name2 = names.get(r2.chr)
  const [mySum, theirSum] = await Promise.all([
    pairSum(mine, r1.chr, r2.chr, resolution),
    name1 !== undefined && name2 !== undefined
      ? pairSum(theirs, name1, name2, resolution)
      : undefined,
  ])
  const query =
    mySum && theirSum && name1 !== undefined && name2 !== undefined
      ? {
          mine,
          theirs,
          r1,
          r2,
          c1: { ...r1, chr: name1 },
          c2: { ...r2, chr: name2 },
          mySum,
          theirSum,
          normalization,
          resolution,
          opts,
        }
      : undefined
  const [observed, control] = query
    ? await readBoth(query)
    : [
        mySum
          ? await readPair(mine.hic, r1, r2, normalization, resolution, opts)
          : undefined,
        undefined,
      ]
  return query && observed && control
    ? joinPair(query, observed, control)
    : observed
}
