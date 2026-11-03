import { isPlacedRow } from './rowPlacement.ts'
import { cloneDrawnYLanes, shiftDrawnYLanes } from './yLanes.ts'

import type { FeatureDataResult } from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { LabelRoomFactors } from './layoutInputs.ts'

// Above this many rects the per-frame re-upload costs more than the animation
// is worth, so snap instead.
const MORPH_MAX_RECTS = 20000

// Keyed by id, not array index, so the transition survives a re-fetch that
// rebuilds the primitive arrays.
type FeatureTops = Map<string, number>

const NO_TOPS: FeatureTops = new Map()

// `undefined` for a feature with no previous row or one the packer left
// unplaced, so nothing sweeps toward the offscreen sentinel.
function morphDelta(
  fromTops: FeatureTops,
  featureId: string,
  targetTop: number,
) {
  const prevTop = fromTops.get(featureId)
  return prevTop !== undefined && isPlacedRow(targetTop)
    ? prevTop - targetTop
    : undefined
}

// Equal signatures differ only in row assignment and can morph; a changed one
// rescaled the rows and must snap. Reads the rendered label flags, not the
// raw config, because a fit-stage boundary can drop descriptions without a
// config flag changing; the stage, the label room factors, the gene-only
// density state, `bodyScale` and `maxIsoforms` ride along because two stacks
// at different values rescale rows with every other field equal.
export function rowGeometrySignature(g: {
  displayMode: string
  renderedShowLabels: boolean
  renderedShowDescriptions: boolean
  fitScale: number
  bodyScale: number
  fitLevel: string
  labelRoomFactors: LabelRoomFactors | undefined
  geneNamesOnly: boolean
  maxIsoforms: number | undefined
}) {
  return [
    g.displayMode,
    g.renderedShowLabels,
    g.renderedShowDescriptions,
    g.fitScale,
    g.bodyScale,
    g.fitLevel,
    g.labelRoomFactors?.labelRoomFactor,
    g.labelRoomFactors?.geneLabelRoomFactor,
    g.geneNamesOnly,
    g.maxIsoforms,
  ].join('|')
}

// Unplaced features are skipped so one that lands on screen in the new layout
// is not animated in from ~-1e6. Given `fromTops`/`t`, each feature is
// captured where it is displayed mid-flight, which is what re-seeds a morph
// interrupted by a second layout change without a visible snap.
export function captureFeatureTops(
  map: ReadonlyMap<number, FeatureDataResult>,
  fromTops: FeatureTops = NO_TOPS,
  t = 1,
): FeatureTops {
  const out: FeatureTops = new Map()
  for (const data of map.values()) {
    for (const item of data.flatbushItems) {
      if (isPlacedRow(item.topPx)) {
        const { featureId, topPx } = item
        const delta = morphDelta(fromTops, featureId, topPx) ?? 0
        out.set(featureId, topPx + delta * (1 - t))
      }
    }
  }
  return out
}

// A stable-seeded repack that moved nothing would burn a 300ms rAF loop
// deriving identical frames.
export function canMorph(
  fromTops: FeatureTops,
  target: ReadonlyMap<number, FeatureDataResult>,
) {
  let rectCount = 0
  let moved = false
  for (const data of target.values()) {
    rectCount += data.rectYs.length
    if (!moved) {
      for (const item of data.flatbushItems) {
        const d = morphDelta(fromTops, item.featureId, item.topPx)
        if (d !== undefined && d !== 0) {
          moved = true
          break
        }
      }
    }
  }
  return moved && rectCount <= MORPH_MAX_RECTS
}

// Only the drawn lanes ease. The hit-test boxes pass through from `target`, so
// hit testing reads the destination layout mid-animation.
export function interpolateYData(
  fromTops: FeatureTops,
  target: ReadonlyMap<number, FeatureDataResult>,
  t: number,
): Map<number, FeatureDataResult> {
  const rem = 1 - t
  const out = new Map<number, FeatureDataResult>()
  for (const [regionIdx, data] of target) {
    const items = data.flatbushItems
    const remainingById = new Map<string, number>()
    const remainingByIndex = new Float64Array(items.length)
    let moved = false
    for (let i = 0; i < items.length; i++) {
      const item = items[i]!
      const d = morphDelta(fromTops, item.featureId, item.topPx)
      if (d !== undefined) {
        remainingByIndex[i] = d * rem
        remainingById.set(item.featureId, d * rem)
        if (d !== 0) {
          moved = true
        }
      }
    }
    if (!moved || rem === 0) {
      out.set(regionIdx, data)
    } else {
      const shifted = { ...data, ...cloneDrawnYLanes(data) }
      shiftDrawnYLanes(shifted, {
        byFeature: remainingById,
        byIndex: remainingByIndex,
      })
      out.set(regionIdx, shifted)
    }
  }
  return out
}
