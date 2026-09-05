import { isPlacedRow } from './rowPlacement.ts'

import type { FeatureDataResult } from '../RenderFeatureDataRPC/rpcTypes.ts'

export const MORPH_DURATION_MS = 300

// Above this many rects the per-frame re-upload costs more than the animation
// is worth, so snap instead.
const MORPH_MAX_RECTS = 20000

// Keyed by id, not array index, so the transition survives a re-fetch that
// rebuilds the primitive arrays.
type FeatureTops = Map<string, number>

export function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

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

// The DOM overlay boxes read this: their geometry comes from the settled
// `laidOutDataMap`, so without it a highlight sits on the destination row
// while the glyph is still on its way.
export function morphOffset(
  fromTops: FeatureTops,
  featureId: string,
  targetTop: number,
  t: number,
) {
  return (morphDelta(fromTops, featureId, targetTop) ?? 0) * (1 - t)
}

// Equal signatures differ only in row assignment and can morph; a changed one
// rescaled the rows and must snap. Reads the rendered label flags, not the
// raw config, because a fit-stage boundary can drop descriptions without a
// config flag changing; the stage, `labelRoomFactor` and `maxIsoforms` ride
// along because two stacks at different values rescale rows with every other
// field equal.
export function rowGeometrySignature(g: {
  displayMode: string
  renderedShowLabels: boolean
  renderedShowDescriptions: boolean
  fitScale: number
  fitLevel: string
  labelRoomFactor: number | undefined
  maxIsoforms: number | undefined
}) {
  return [
    g.displayMode,
    g.renderedShowLabels,
    g.renderedShowDescriptions,
    g.fitScale,
    g.fitLevel,
    g.labelRoomFactor,
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
        out.set(featureId, topPx + morphOffset(fromTops, featureId, topPx, t))
      }
    }
  }
  return out
}

// Guarded for environments without `performance`, falling back to the epoch
// clock rather than a constant: a clock that never advances leaves the frame
// loop at progress 0 forever.
export function morphClockMs() {
  return typeof performance === 'undefined' ? Date.now() : performance.now()
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

function shift(
  ys: Float32Array,
  featureIndices: Uint32Array,
  deltas: Float64Array,
  rem: number,
) {
  const out = new Float32Array(ys.length)
  for (let i = 0; i < ys.length; i++) {
    out[i] = ys[i]! + deltas[featureIndices[i]!]! * rem
  }
  return out
}

// Non-Y fields pass through from `target`, so hit testing reads the
// destination layout mid-animation.
export function interpolateYData(
  fromTops: FeatureTops,
  target: ReadonlyMap<number, FeatureDataResult>,
  t: number,
): Map<number, FeatureDataResult> {
  const rem = 1 - t
  const out = new Map<number, FeatureDataResult>()
  for (const [regionIdx, data] of target) {
    const items = data.flatbushItems
    const deltas = new Float64Array(items.length)
    const deltaById = new Map<string, number>()
    let moved = false
    for (let i = 0; i < items.length; i++) {
      const item = items[i]!
      const d = morphDelta(fromTops, item.featureId, item.topPx)
      if (d !== undefined) {
        deltas[i] = d
        deltaById.set(item.featureId, d)
        if (d !== 0) {
          moved = true
        }
      }
    }
    if (!moved || rem === 0) {
      out.set(regionIdx, data)
    } else {
      const floatingLabelsData: FeatureDataResult['floatingLabelsData'] =
        new Map()
      for (const [key, label] of data.floatingLabelsData) {
        const delta = deltaById.get(label.parentFeatureId ?? label.featureId)
        floatingLabelsData.set(
          key,
          delta === undefined
            ? label
            : { ...label, topY: label.topY + delta * rem },
        )
      }
      out.set(regionIdx, {
        ...data,
        rectYs: shift(data.rectYs, data.rectFeatureIndices, deltas, rem),
        lineYs: shift(data.lineYs, data.lineFeatureIndices, deltas, rem),
        arrowYs: shift(data.arrowYs, data.arrowFeatureIndices, deltas, rem),
        floatingLabelsData,
        aminoAcidOverlay: data.aminoAcidOverlay?.map(aa => ({
          ...aa,
          topPx: aa.topPx + deltas[aa.flatbushIdx]! * rem,
        })),
      })
    }
  }
  return out
}
