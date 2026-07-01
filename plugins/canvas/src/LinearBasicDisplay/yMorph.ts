import type { FeatureDataResult } from '../RenderFeatureDataRPC/rpcTypes.ts'

// Duration of the feature-Y transition played when the layout re-packs rows
// (e.g. on a zoom step) so features ease into their new row instead of jumping.
export const MORPH_DURATION_MS = 300

// Above this many rect primitives, skip the per-frame interpolate + re-upload
// and snap instead — the animation isn't worth the GPU churn on dense views.
export const MORPH_MAX_RECTS = 20000

// featureId -> row top (px) for the layout being animated away from. Keyed by
// id (not array index) so the transition survives a re-fetch: a zoom rebuilds
// the primitive arrays, but the same features keep their ids.
export type FeatureTops = Map<string, number>

export function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

// Tallest row bottom across a layout, i.e. its content height.
export function maxBottom(map: ReadonlyMap<number, FeatureDataResult>) {
  let max = 0
  for (const data of map.values()) {
    for (const item of data.flatbushItems) {
      if (item.bottomPx > max) {
        max = item.bottomPx
      }
    }
  }
  return max
}

// Snapshot each feature's current row top, to be the start of a later morph.
export function captureFeatureTops(
  map: ReadonlyMap<number, FeatureDataResult>,
): FeatureTops {
  const out: FeatureTops = new Map()
  for (const data of map.values()) {
    for (const item of data.flatbushItems) {
      out.set(item.featureId, item.topPx)
    }
  }
  return out
}

// Whether anything is worth animating: at least one feature shared with
// `fromTops` actually changed row (a shared-but-unmoved feature would make
// `interpolateYData` a no-op, so a stable-seeded repack that kept every feature
// in place shouldn't burn a 300ms rAF loop re-deriving identical frames), and
// the view isn't so dense the per-frame re-upload costs more than it's worth.
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
        const prevTop = fromTops.get(item.featureId)
        if (prevTop !== undefined && prevTop !== item.topPx) {
          moved = true
          break
        }
      }
    }
  }
  return moved && rectCount <= MORPH_MAX_RECTS
}

// How far scrollTop must move to keep the "focused" feature pinned to the same
// screen Y across a repack. Vertical scrolling of these tracks is awkward (wheel
// is overloaded for zoom), so a gene the user zoomed in on must not slide out of
// view when the layout re-packs it onto a different row. The anchor is the
// feature nearest the viewport center that exists in both layouts; the delta is
// how far its row moved (newTop - oldTop). Shifting scrollTop by this keeps its
// on-screen position fixed. Returns 0 when no feature is shared (nothing to
// pin) or the anchor didn't move. Used both to ease scrollTop in lockstep with
// a morph and to compensate an un-animated snap.
export function focusScrollDelta(
  fromTops: FeatureTops,
  newTops: FeatureTops,
  viewportCenterY: number,
) {
  let bestDelta = 0
  let bestDist = Number.POSITIVE_INFINITY
  for (const [id, oldTop] of fromTops) {
    const newTop = newTops.get(id)
    if (newTop !== undefined) {
      const dist = Math.abs(oldTop - viewportCenterY)
      if (dist < bestDist) {
        bestDist = dist
        bestDelta = newTop - oldTop
      }
    }
  }
  return bestDelta
}

// Shift each primitive's Y by `rem` of its feature's (oldTop - newTop) delta.
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

// Returns a render-only map whose Y fields (rect/line/arrow rows, label tops,
// peptide tops) are eased from each feature's previous row toward its new one:
// at t=0 features sit where they were, at t=1 at the destination. Non-Y fields
// (positions, colors, hit-test extents) pass through from `target`, so hit
// testing reads the destination layout even mid-animation. Features absent from
// `fromTops` (newly appeared) are left at their destination.
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
    let moved = false
    for (let i = 0; i < items.length; i++) {
      const prevTop = fromTops.get(items[i]!.featureId)
      if (prevTop !== undefined) {
        const d = prevTop - items[i]!.topPx
        deltas[i] = d
        if (d !== 0) {
          moved = true
        }
      }
    }
    if (!moved || rem === 0) {
      out.set(regionIdx, data)
    } else {
      const targetTops = new Map<string, number>()
      for (const item of items) {
        targetTops.set(item.featureId, item.topPx)
      }
      const floatingLabelsData: FeatureDataResult['floatingLabelsData'] = {}
      for (const key in data.floatingLabelsData) {
        const label = data.floatingLabelsData[key]!
        const id = label.parentFeatureId ?? label.featureId
        const prevTop = fromTops.get(id)
        const newTop = targetTops.get(id)
        floatingLabelsData[key] =
          prevTop !== undefined && newTop !== undefined
            ? { ...label, topY: label.topY + (prevTop - newTop) * rem }
            : label
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
