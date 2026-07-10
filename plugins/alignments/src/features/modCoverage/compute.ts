import { withAbgrAlpha } from '@jbrowse/core/util/colorBits'

import { calculateModificationCounts } from '../../shared/calculateModificationCounts.ts'

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
  // ChEBI codes) from merging into one base/denominator, matching
  // buildModTooltipData's grouping.
  const modTypeIds = new Map<string, number>()
  const modKey = (mod: ModificationEntry) => {
    let id = modTypeIds.get(mod.modType)
    if (id === undefined) {
      id = modTypeIds.size
      modTypeIds.set(mod.modType, id)
    }
    return id * 2 + (mod.noMod ? 1 : 0)
  }

  for (const mod of modifications) {
    if (mod.position >= regionStart) {
      let colorMap = byPosition.get(mod.position)
      if (!colorMap) {
        colorMap = new Map()
        byPosition.set(mod.position, colorMap)
      }
      const key = modKey(mod)
      let entry = colorMap.get(key)
      if (!entry) {
        entry = {
          color: mod.color,
          probabilityTotal: 0,
          probabilityCount: 0,
          base: mod.base,
          modType: mod.modType,
          noMod: mod.noMod ?? false,
        }
        colorMap.set(key, entry)
      }
      entry.probabilityTotal += mod.prob
      entry.probabilityCount++
    }
  }
  return byPosition
}

// Stacked segments for one position, bottom-up. `heightOf` gives each bin its
// fraction of the bar; a zero-height bin emits nothing. Segment alpha is the
// bin's average call likelihood (bisulfite calls are prob 1 → fully opaque).
function stackBar(
  colorMap: Map<number, ModificationColorEntry>,
  position: number,
  relDepth: number,
  heightOf: (entry: ModificationColorEntry) => number,
) {
  const out: CoverageSegment[] = []
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
  return out
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
  const { depths, maxDepth, startPos } = coverage
  const segments: CoverageSegment[] = []
  for (const [position, colorMap] of groupByPosition(
    modifications,
    regionStart,
  )) {
    const depthAtPosition = depths[Math.floor(position - startPos)] ?? 0
    if (depthAtPosition > 0) {
      const strandBaseCounts = baseCounts.get(position) ?? {}
      segments.push(
        ...stackBar(colorMap, position, depthAtPosition / maxDepth, entry => {
          const { modifiable, detectable } = calculateModificationCounts({
            base: entry.base,
            isSimplex: simplexModifications.has(entry.modType),
            strandBaseCounts,
          })
          return detectable === 0
            ? 0
            : (modifiable / depthAtPosition) *
                (entry.probabilityCount / detectable)
        }),
      )
    }
  }
  return packSegments(segments)
}

/**
 * Bisulfite/EM-seq methylation coverage (colorBy bisulfite). A cytosine reads as
 * a binary C-vs-T call, so the informative reads at a position are exactly the
 * methylated + unmethylated calls emitted there (the two `noMod` bins). The bar
 * is a per-position methylation level: each state takes its share of those calls
 * and they fill the WHOLE bar (meth + unmeth = 1), like a mini methylation track
 * — matching IGV's BisulfiteCounts.
 *
 * It deliberately takes no read-base pileup: an unmethylated cytosine reads as T
 * (C->T converted), so the C/G base count the modBAM path divides by would
 * exclude it and cap the methylated fraction near 0.5 (the half-height bar bug).
 */
export function computeBisulfiteCoverage(
  modifications: ModificationEntry[],
  regionStart: number,
  coverage: Coverage,
) {
  const { depths, maxDepth, startPos } = coverage
  const segments: CoverageSegment[] = []
  for (const [position, colorMap] of groupByPosition(
    modifications,
    regionStart,
  )) {
    const depthAtPosition = depths[Math.floor(position - startPos)] ?? 0
    if (depthAtPosition > 0) {
      const totalCalls = [...colorMap.values()].reduce(
        (sum, e) => sum + e.probabilityCount,
        0,
      )
      segments.push(
        ...stackBar(
          colorMap,
          position,
          depthAtPosition / maxDepth,
          entry => entry.probabilityCount / totalCalls,
        ),
      )
    }
  }
  return packSegments(segments)
}
