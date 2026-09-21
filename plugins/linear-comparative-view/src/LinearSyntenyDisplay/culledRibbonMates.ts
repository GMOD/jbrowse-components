import { paintsFeatureColor } from '../LinearSyntenyRPC/syntenyColors.ts'

import type { SyntenyGeometry } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'
import type {
  MateAxisPlacement,
  OffscreenMateDataset,
} from './drawOffscreenMates.ts'

// The half of "this band cannot draw a ribbon for it" the worker cannot
// answer: the mate's contig IS displayed and has scrolled out of the band,
// which `isRibbonCulled` drops per frame. Stacked whole assemblies make this
// class everything and the worker's class empty. Decided at draw time, since
// the facing row pans a whole buffer without refetching.
export interface CulledRibbonMateData extends OffscreenMateDataset {
  mateAxis: MateAxisPlacement
}

// Both perspectives, since culling drops a ribbon when either end leaves its
// row: an alignment can be undrawable with its query end off screen and its
// target end in plain sight, and then the target axis is the only one it has
// a position on
export interface CulledRibbonMates {
  onQueryAxis: CulledRibbonMateData
  onTargetAxis: CulledRibbonMateData
}

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

// Every alignment this level drew geometry for, placed on both axes in absolute
// cumBp. Taken off the instances rather than the feature lanes, which carry
// the adapter's untrimmed coordinates: a CIGAR-clipped block draws from
// corners the projection loop moved. A feature whose instances all fell off
// screen keeps its sentinel span (`starts` above `ends`), which the layout's
// x test drops. Given the per-instance colours, a feature whose ribbon is
// painted transparent is dropped whole, marks and tallies alike, since the band
// shows nothing of it to account for.
export function culledRibbonMateData(
  geometry: SyntenyGeometry,
  features: CulledMateFeatureLanes,
  colors?: Uint32Array,
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
    kinds,
    instanceFeatureIdx,
    alignmentLengths,
    instanceCount,
  } = geometry
  const hidden = new Uint8Array(colors ? n : 0)
  for (let i = 0; i < instanceCount; i++) {
    const f = instanceFeatureIdx[i]!
    if (colors && paintsFeatureColor(kinds[i]!) && colors[i]! >>> 24 === 0) {
      hidden[f] = 1
    }
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
  const queryAlignedBp = new Float64Array(refNameDict.length)
  const targetAlignedBp = new Float64Array(mateRefNameDict.length)
  let queryLo = Infinity
  let queryHi = -Infinity
  let targetLo = Infinity
  let targetHi = -Infinity
  for (let f = 0; f < n; f++) {
    if (hidden[f]) {
      queryStarts[f] = Infinity
      queryEnds[f] = -Infinity
      targetStarts[f] = Infinity
      targetEnds[f] = -Infinity
      continue
    }
    queryCounts[refNameIds[f]!]! += 1
    targetCounts[mateRefNameIds[f]!]! += 1
    queryAlignedBp[refNameIds[f]!]! += lengths[f]!
    targetAlignedBp[mateRefNameIds[f]!]! += lengths[f]!
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
      alignedBp: targetAlignedBp,
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
      alignedBp: queryAlignedBp,
      starts: targetStarts,
      ends: targetEnds,
      lengths,
      mateStarts: features.starts,
      mateEnds: features.ends,
      mateAxis: queryAxis,
    },
  }
}
