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

export interface CulledMateFeatureLanes {
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
 * — `starts` above `ends` — which the layout's own x-range test drops.
 */
export function culledRibbonMateData(
  geometry: SyntenyGeometry,
  features: CulledMateFeatureLanes,
): CulledRibbonMateData {
  const { mateRefNameDict, mateRefNameIds } = features
  const n = mateRefNameIds.length
  const starts = new Float64Array(n).fill(Infinity)
  const ends = new Float64Array(n).fill(-Infinity)
  const mateCumBpStarts = new Float64Array(n).fill(Infinity)
  const mateCumBpEnds = new Float64Array(n).fill(-Infinity)
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
    starts[f] = Math.min(starts[f]!, q1, q2)
    ends[f] = Math.max(ends[f]!, q1, q2)
    mateCumBpStarts[f] = Math.min(mateCumBpStarts[f]!, m1, m2)
    mateCumBpEnds[f] = Math.max(mateCumBpEnds[f]!, m1, m2)
    lengths[f] = alignmentLengths[i]!
  }
  const counts = new Uint32Array(mateRefNameDict.length)
  let mateCumBpLo = Infinity
  let mateCumBpHi = -Infinity
  for (let f = 0; f < n; f++) {
    counts[mateRefNameIds[f]!]! += 1
    const qLo = starts[f]!
    const qHi = ends[f]!
    if (qLo <= qHi) {
      const mLo = mateCumBpStarts[f]! + base1
      const mHi = mateCumBpEnds[f]! + base1
      starts[f] = qLo + base0
      ends[f] = qHi + base0
      mateCumBpStarts[f] = mLo
      mateCumBpEnds[f] = mHi
      mateCumBpLo = Math.min(mateCumBpLo, mLo)
      mateCumBpHi = Math.max(mateCumBpHi, mHi)
    }
  }
  return {
    mateRefNameDict,
    mateRefNameIds,
    counts,
    starts,
    ends,
    lengths,
    mateStarts: features.mateStarts,
    mateEnds: features.mateEnds,
    mateAxis: {
      starts: mateCumBpStarts,
      ends: mateCumBpEnds,
      lo: mateCumBpLo,
      hi: mateCumBpHi,
    },
  }
}
