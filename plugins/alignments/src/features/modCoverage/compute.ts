import { withAbgrAlpha } from '@jbrowse/core/util/colorBits'

import { calculateModificationCounts } from '../../shared/calculateModificationCounts.ts'
import { getOrCreate } from '../../shared/util.ts'

import type { StrandBaseCounts } from '../../shared/calculateModificationCounts.ts'
import type { ModificationEntry } from '../../shared/webglRpcTypes.ts'

interface ModificationColorEntry {
  color: number // packed ABGR (opaque)
  probabilityTotal: number
  probabilityCount: number
  base: string
  modType: string
  noMod: boolean
}

// One stacked rectangle of a position's coverage bar. yOffset/height are
// fractions of THIS position's bar (per-position semantics); relDepth =
// depthAtPos / maxDepth sets the bar's own height at draw time. Same contract as
// computeSNPCoverage.
interface CoverageSegment {
  position: number
  yOffset: number
  height: number
  relDepth: number
  color: number // packed ABGR (opaque)
  alpha: number
}

interface Coverage {
  depths: Float32Array
  maxDepth: number
  startPos: number
}

// A bin's height as a fraction of its position's coverage bar. The two coverage
// models differ only in this function; everything else is shared.
type BinHeight = (entry: ModificationColorEntry) => number

// Fixed stack order so a position's segments never swap between frames (they
// otherwise stacked in read-arrival order). Mirrors IGV's modificationRankOrder
// but renders modified calls BELOW the no-modification bucket, so e.g. red 5mC
// always sits under blue unmodified. Lower rank = drawn first = bottom.
const MOD_TYPE_RANK: Record<string, number> = {
  m: 0,
  h: 1,
  f: 2,
  c: 3,
  C: 4,
  g: 5,
  e: 6,
  b: 7,
  a: 8,
  o: 9,
}
// Total order (no ties) so it's deterministic for numeric ChEBI codes too, which
// share the fallback rank and need the lexical modType tiebreak to not swap.
function compareModEntries(
  a: ModificationColorEntry,
  b: ModificationColorEntry,
) {
  const ra = MOD_TYPE_RANK[a.modType] ?? 99
  const rb = MOD_TYPE_RANK[b.modType] ?? 99
  return a.noMod !== b.noMod
    ? a.noMod
      ? 1
      : -1
    : ra !== rb
      ? ra - rb
      : a.modType < b.modType
        ? -1
        : a.modType > b.modType
          ? 1
          : 0
}

// Group calls by genomic position, then by (modType, noMod) within a position,
// summing each bin's probability count/total. Both coverage models build from
// this and differ only in how a bin's bar height is derived.
function groupByPosition(
  modifications: ModificationEntry[],
  regionStart: number,
) {
  const byPosition = new Map<number, Map<number, ModificationColorEntry>>()

  // Stable small integer id per modType, so each stacked segment can be keyed by
  // its modification identity with a numeric (fast, allocation-free) Map key
  // rather than a per-mod template string. Distinguishing by type — not color —
  // keeps two distinct types that happen to share an RGB (possible for numeric
  // ChEBI codes) from merging into one base/denominator. buildModTooltipData
  // keys on type AND color, so this grouping is strictly coarser but consistent
  // (a given modType resolves to one color).
  const modTypeIds = new Map<string, number>()
  const modKey = (mod: ModificationEntry) => {
    const id = getOrCreate(modTypeIds, mod.modType, () => modTypeIds.size)
    return id * 2 + (mod.noMod ? 1 : 0)
  }

  for (const mod of modifications) {
    if (mod.position >= regionStart) {
      const colorMap = getOrCreate(
        byPosition,
        mod.position,
        () => new Map<number, ModificationColorEntry>(),
      )
      const entry = getOrCreate(colorMap, modKey(mod), () => ({
        color: mod.color,
        probabilityTotal: 0,
        probabilityCount: 0,
        base: mod.base,
        modType: mod.modType,
        noMod: mod.noMod ?? false,
      }))
      entry.probabilityTotal += mod.prob
      entry.probabilityCount++
    }
  }
  return byPosition
}

// Stacked segments for one position, bottom-up, appended to `out`. `heightOf`
// gives each bin its fraction of the bar; a zero-height bin emits nothing.
// Segment alpha is the bin's average call likelihood (bisulfite calls are prob 1
// → fully opaque).
//
// Appends rather than returning its own array because the caller runs this once
// per modified position — tens of thousands of them on a methylation pileup —
// and `segments.push(...stackBar(…))` allocated a list per position only to
// spread it away.
function stackBar(
  out: CoverageSegment[],
  colorMap: Map<number, ModificationColorEntry>,
  position: number,
  relDepth: number,
  heightOf: BinHeight,
) {
  let yOffset = 0
  for (const entry of [...colorMap.values()].sort(compareModEntries)) {
    const height = heightOf(entry)
    if (height > 0) {
      out.push({
        position,
        yOffset,
        height,
        relDepth,
        color: entry.color,
        alpha: Math.round(
          (entry.probabilityTotal / entry.probabilityCount) * 255,
        ),
      })
      yOffset += height
    }
  }
}

// Pack the accumulated segments into the GPU typed-array layout. An empty list
// yields empty arrays, so neither caller needs an empty-input special case.
function packSegments(segments: CoverageSegment[]) {
  const positions = new Uint32Array(segments.length)
  const yOffsets = new Float32Array(segments.length)
  const heights = new Float32Array(segments.length)
  // Packed ABGR u32 per segment (alpha byte = seg.alpha, 0..255).
  const colors = new Uint32Array(segments.length)
  const relDepths = new Float32Array(segments.length)
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!
    positions[i] = seg.position
    yOffsets[i] = seg.yOffset
    heights[i] = seg.height
    colors[i] = withAbgrAlpha(seg.color, seg.alpha)
    relDepths[i] = seg.relDepth
  }
  return {
    positions,
    yOffsets,
    heights,
    colors,
    relDepths,
    count: segments.length,
  }
}

// Group the calls, then stack a bar at every position that has read depth. A
// coverage model supplies only `heightForPosition`: given a position's context
// it returns that position's per-bin height function (so per-position setup like
// a denominator is computed once, not per bin). The iteration, depth gate,
// bar-height scaling, and GPU packing are shared here so the two models can't
// drift.
function stackCoverageBars(
  modifications: ModificationEntry[],
  regionStart: number,
  coverage: Coverage,
  heightForPosition: (ctx: {
    position: number
    colorMap: Map<number, ModificationColorEntry>
    depthAtPosition: number
  }) => BinHeight,
) {
  const { depths, maxDepth, startPos } = coverage
  const segments: CoverageSegment[] = []
  for (const [position, colorMap] of groupByPosition(
    modifications,
    regionStart,
  )) {
    const depthAtPosition = depths[position - startPos] ?? 0
    if (depthAtPosition > 0) {
      stackBar(
        segments,
        colorMap,
        position,
        depthAtPosition / maxDepth,
        heightForPosition({ position, colorMap, depthAtPosition }),
      )
    }
  }
  return packSegments(segments)
}

/**
 * modBAM base-modification coverage (colorBy modifications/methylation). Each
 * mod's bar height mirrors IGV's BaseModificationCoverageRenderer:
 * `(modifiable/depth)` scales the above-threshold read count down to the reads
 * that even carry the base, and dividing by `detectable` (not `depth`) corrects
 * for simplex data, where only the examined strand was basecalled so half the
 * reads could never show the mod. Duplex → `detectable === modifiable`,
 * collapsing to `probabilityCount/depth`. Height is a plain read COUNT (each
 * qualifying read weighs 1); likelihood feeds only the segment alpha.
 * `baseCounts` is the IGV-style per-strand read-base pileup
 * (computeReadBaseCounts) — no reference sequence needed.
 */
export function computeModificationCoverage(
  modifications: ModificationEntry[],
  baseCounts: ReadonlyMap<number, StrandBaseCounts>,
  regionStart: number,
  coverage: Coverage,
  simplexModifications: ReadonlySet<string>,
) {
  return stackCoverageBars(
    modifications,
    regionStart,
    coverage,
    ({ position, depthAtPosition }) => {
      const strandBaseCounts = baseCounts.get(position) ?? {}
      return entry => {
        const { modifiable, detectable } = calculateModificationCounts({
          base: entry.base,
          isSimplex: simplexModifications.has(entry.modType),
          strandBaseCounts,
        })
        return detectable === 0
          ? 0
          : (modifiable / depthAtPosition) *
              (entry.probabilityCount / detectable)
      }
    },
  )
}

/**
 * Bisulfite/EM-seq methylation coverage (colorBy bisulfite). A cytosine reads as
 * a binary C-vs-T call, so the bar is a per-position methylation level: each
 * state takes its share of the calls made there and they fill the WHOLE bar
 * (meth + unmeth = 1), like a mini methylation track — matching IGV's
 * BisulfiteCounts.
 *
 * `callCounts` (position -> methylated + unmethylated calls, from
 * `extractBisulfite`) is the denominator, and counting it at extraction is what
 * makes the level independent of `twoColor`. Deriving it from the marks instead
 * looks equivalent and is not: single-colour mode paints only the methylated
 * state, so the marks at a position are its numerator and every bar came out at
 * height 1.
 *
 * Two denominators that are wrong here, both giving a half-height bar:
 *
 * - The read-base pileup the modBAM path divides by. An unmethylated cytosine
 *   reads as T (C->T converted), so a C/G base count excludes it.
 * - Read depth. Only the reads whose template strand is the examined one call a
 *   given cytosine, so a directional library covers a CpG's C with the whole
 *   pileup while half of it calls the G instead.
 */
export function computeBisulfiteCoverage(
  modifications: ModificationEntry[],
  callCounts: ReadonlyMap<number, number>,
  regionStart: number,
  coverage: Coverage,
) {
  return stackCoverageBars(
    modifications,
    regionStart,
    coverage,
    ({ position }) => {
      const totalCalls = callCounts.get(position) ?? 0
      return entry => (totalCalls > 0 ? entry.probabilityCount / totalCalls : 0)
    },
  )
}
