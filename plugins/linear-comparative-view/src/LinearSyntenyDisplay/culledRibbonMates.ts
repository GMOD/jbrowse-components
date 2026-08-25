import type { SyntenyGeometry } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'
import type {
  MateAxisPlacement,
  OffscreenMateDataset,
} from './drawOffscreenMates.ts'

/**
 * The other half of "this band cannot draw a ribbon for it".
 *
 * `collectOffscreenMates` answers the half the WORKER can: the mate is on a
 * contig the facing row does not display at all, so there is no second endpoint
 * anywhere. This is the half it cannot — the contig IS displayed, and the mate
 * has simply scrolled out of the band, which `isRibbonCulled` drops per frame.
 * Stacked whole assemblies make that class everything and the worker's class
 * empty: every mate refName is displayed, so nothing was ever counted, while
 * `overdrawPx` was culling all but the ribbons reaching the visible slice.
 *
 * A MARK IS THEREFORE A DRAW-TIME QUESTION, and cannot be moved into the fetch.
 * The facing row pans a whole buffer without refetching, so a mark decided when
 * the data landed sits next to the ribbon it claims does not exist.
 *
 * What it costs is one pass over the instances per fetch. `mateAxis`'s extent
 * is what keeps the per-frame half free in the common case: a facing row whose
 * band already spans every mate this fetch holds can hide none of them, so the
 * whole dataset drops out of the lane on two comparisons.
 */
export interface CulledRibbonMateData extends OffscreenMateDataset {
  mateAxis: MateAxisPlacement
}

/**
 * The same alignments seen from each of the band's two rows.
 *
 * BOTH, BECAUSE CULLING IS SYMMETRIC AND THE VIEW WAS NOT. `isRibbonCulled`
 * drops a ribbon when EITHER edge leaves its row's band, so an alignment can be
 * undrawable with its query end off screen and its target end in plain sight —
 * and then the only axis it has a position on is the target's. Marked on the
 * query axis alone it fell through both surfaces: no ribbon, and a mark at an x
 * the layout rejects. On peach chr1 18-22Mb over the whole of grape chr1, with
 * the second fetch on, that is 849 of the 1029 alignments the level holds.
 *
 * ONE PASS FOR THE PAIR. The instance walk resolves both axes already — it has
 * to, since the query span is what says whether the target span is a mate at
 * all — so the second perspective is the extents and one more per-contig tally,
 * and the two share every per-feature array between them.
 */
export interface CulledRibbonMates {
  onQueryAxis: CulledRibbonMateData
  onTargetAxis: CulledRibbonMateData
}

/**
 * The per-feature lanes of the fetch, BOTH SIDES of them: each perspective
 * places its marks on one axis and names the contig on the other, so the pair
 * needs the pair.
 */
export interface CulledMateFeatureLanes {
  refNameDict: string[]
  refNameIds: Uint32Array
  starts: ArrayLike<number>
  ends: ArrayLike<number>
  mateRefNameDict: string[]
  mateRefNameIds: Uint32Array
  mateStarts: ArrayLike<number>
  mateEnds: ArrayLike<number>
}

/**
 * Every alignment this level drew geometry for, placed on both axes in absolute
 * cumBp.
 *
 * TAKEN OFF THE INSTANCES rather than reprojected from the feature lanes, which
 * carry the adapter's untrimmed coordinates: a CIGAR-clipped block draws from
 * corners the projection loop moved, so a mark reprojected from `starts`/`ends`
 * would sit beside its own ribbon rather than on it. Min/max over a feature's
 * instances also covers the transparent-CIGAR mode, where the base trapezoid is
 * replaced by one tile per match segment and no single instance spans the block.
 *
 * A feature whose instances were all emitted off-screen keeps its sentinel span
 * — `starts` above `ends` — which the layout's own x-range test drops. The query
 * span is what decides that for both perspectives: an instance writes its four
 * corners together, so a feature with a span on one axis has one on the other.
 */
export function culledRibbonMateData(
  geometry: SyntenyGeometry,
  features: CulledMateFeatureLanes,
): CulledRibbonMates {
  const { refNameDict, refNameIds, mateRefNameDict, mateRefNameIds } = features
  const n = mateRefNameIds.length
  const queryStarts = new Float64Array(n).fill(Infinity)
  const queryEnds = new Float64Array(n).fill(-Infinity)
  const targetStarts = new Float64Array(n).fill(Infinity)
  const targetEnds = new Float64Array(n).fill(-Infinity)
  const lengths = new Float32Array(n)
  const {
    bp1,
    bp2,
    bp3,
    bp4,
    base0,
    base1,
    instanceFeatureIdx,
    alignmentLengths,
    instanceCount,
  } = geometry
  for (let i = 0; i < instanceCount; i++) {
    const f = instanceFeatureIdx[i]!
    const q1 = bp1[i]!
    const q2 = bp2[i]!
    const m1 = bp3[i]!
    const m2 = bp4[i]!
    queryStarts[f] = Math.min(queryStarts[f]!, q1, q2)
    queryEnds[f] = Math.max(queryEnds[f]!, q1, q2)
    targetStarts[f] = Math.min(targetStarts[f]!, m1, m2)
    targetEnds[f] = Math.max(targetEnds[f]!, m1, m2)
    lengths[f] = alignmentLengths[i]!
  }
  const queryCounts = new Uint32Array(refNameDict.length)
  const targetCounts = new Uint32Array(mateRefNameDict.length)
  let queryLo = Infinity
  let queryHi = -Infinity
  let targetLo = Infinity
  let targetHi = -Infinity
  for (let f = 0; f < n; f++) {
    queryCounts[refNameIds[f]!]! += 1
    targetCounts[mateRefNameIds[f]!]! += 1
    const qLo = queryStarts[f]!
    const qHi = queryEnds[f]!
    if (qLo <= qHi) {
      const q0 = qLo + base0
      const q1 = qHi + base0
      const m0 = targetStarts[f]! + base1
      const m1 = targetEnds[f]! + base1
      queryStarts[f] = q0
      queryEnds[f] = q1
      targetStarts[f] = m0
      targetEnds[f] = m1
      queryLo = Math.min(queryLo, q0)
      queryHi = Math.max(queryHi, q1)
      targetLo = Math.min(targetLo, m0)
      targetHi = Math.max(targetHi, m1)
    }
  }
  const queryAxis = {
    starts: queryStarts,
    ends: queryEnds,
    lo: queryLo,
    hi: queryHi,
  }
  const targetAxis = {
    starts: targetStarts,
    ends: targetEnds,
    lo: targetLo,
    hi: targetHi,
  }
  return {
    onQueryAxis: {
      mateRefNameDict,
      mateRefNameIds,
      counts: targetCounts,
      starts: queryStarts,
      ends: queryEnds,
      lengths,
      mateStarts: features.mateStarts,
      mateEnds: features.mateEnds,
      mateAxis: targetAxis,
    },
    onTargetAxis: {
      mateRefNameDict: refNameDict,
      mateRefNameIds: refNameIds,
      counts: queryCounts,
      starts: targetStarts,
      ends: targetEnds,
      lengths,
      mateStarts: features.starts,
      mateEnds: features.ends,
      mateAxis: queryAxis,
    },
  }
}
