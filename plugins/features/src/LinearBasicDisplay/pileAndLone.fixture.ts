import {
  makeFeatureData,
  makeFlatbushItem,
} from '../RenderFeatureDataRPC/testUtils.ts'

import type { FloatingLabelsDataMap } from '../RenderFeatureDataRPC/rpcTypes.ts'

// A named feature stacked over nameless ones, so its name costs a row, and a
// second hemmed in by nameless neighbours, whose name costs none but reads
// less room than the stacked one's. Last in the window, the stacked one's
// room is unbounded, so no factor drops its name. Neither is a gene, whose
// name would solve over bodies at the squeeze floor and fit.
export const PILE_FIRST = [
  { featureId: 'first', startPx: 0, endPx: 50 },
  { featureId: 'p1', startPx: 100, endPx: 400 },
  { featureId: 'p2', startPx: 100, endPx: 400 },
  { featureId: 'piled', startPx: 100, endPx: 400, named: true },
  { featureId: 'before', startPx: 700, endPx: 880 },
  { featureId: 'lone', startPx: 900, endPx: 1000, named: true },
  { featureId: 'after', startPx: 1020, endPx: 1100 },
]
export const PILE_LAST = [
  { featureId: 'first', startPx: 0, endPx: 50 },
  { featureId: 'before', startPx: 100, endPx: 280 },
  { featureId: 'lone', startPx: 300, endPx: 400, named: true },
  { featureId: 'after', startPx: 420, endPx: 500 },
  { featureId: 'p1', startPx: 600, endPx: 1000 },
  { featureId: 'p2', startPx: 600, endPx: 1000 },
  { featureId: 'piled', startPx: 600, endPx: 900, named: true },
]

export function pileAndLoneData(
  bpPerPx: number,
  layout: {
    featureId: string
    startPx: number
    endPx: number
    named?: boolean
  }[],
) {
  const features = layout.map(f => ({
    ...f,
    startBp: Math.round((f.startPx / 2) * bpPerPx),
    endBp: Math.round((f.endPx / 2) * bpPerPx),
  }))
  const height = 20
  const floatingLabelsData: FloatingLabelsDataMap = new Map()
  for (const f of features) {
    if (f.named) {
      floatingLabelsData.set(f.featureId, {
        featureId: f.featureId,
        minX: f.startBp,
        maxX: f.endBp,
        topY: 0,
        featureHeight: height,
        nameLabel: { text: f.featureId, textWidth: 40 },
      })
    }
  }
  return makeFeatureData({
    flatbushItems: features.map(f =>
      makeFlatbushItem({
        featureId: f.featureId,
        type: 'feature',
        startBp: f.startBp,
        endBp: f.endBp,
        bottomPx: height,
        featureHeightPx: height,
      }),
    ),
    rectPositions: new Uint32Array(features.flatMap(f => [f.startBp, f.endBp])),
    rectYs: new Float32Array(features.length),
    rectHeights: new Float32Array(features.length).fill(height),
    rectColors: new Uint32Array(features.length),
    rectStrands: new Float32Array(features.length),
    rectDensityFade: new Uint32Array(features.length),
    rectFeatureIndices: new Uint32Array(features.map((_, i) => i)),
    floatingLabelsData,
  })
}
