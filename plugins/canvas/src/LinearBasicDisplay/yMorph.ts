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

// How far a feature should ease during a morph: its old row top minus its new
// one. `undefined` when the feature has no previous row (newly appeared — leave
// it at its destination) or when it overflows off-screen in the target
// (topPx = OFFSCREEN_Y < 0 — don't sweep it toward ~-1e6). The single guard both
// morph directions and the displayed-top capture share, so they can't drift.
function morphDelta(
  fromTops: FeatureTops,
  featureId: string,
  targetTop: number,
) {
  const prevTop = fromTops.get(featureId)
  return prevTop !== undefined && targetTop >= 0 ? prevTop - targetTop : undefined
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

// Snapshot each on-screen feature's row top by id. Used both as the start of a
// later morph and to seed the next re-pack's insertion order (layout.ts).
// Features that overflowed maxHeight (topPx = OFFSCREEN_Y, a large negative;
// see layout.ts) are skipped so a feature that was overflowed in the old layout
// and lands on-screen in the new one isn't animated flying in from ~-1e6, nor
// sorted ahead of genuinely on-screen features when seeding.
export function captureFeatureTops(
  map: ReadonlyMap<number, FeatureDataResult>,
): FeatureTops {
  const out: FeatureTops = new Map()
  for (const data of map.values()) {
    for (const item of data.flatbushItems) {
      if (item.topPx >= 0) {
        out.set(item.featureId, item.topPx)
      }
    }
  }
  return out
}

// Each on-screen feature's *currently displayed* top when a morph is in flight,
// i.e. its position eased `t` of the way from `fromTops` to `target`. Used to
// re-seed a morph interrupted mid-flight by a second layout change (a pin toggle
// or region flip, neither debounced like zoom): starting the new morph from
// these live positions instead of `target`'s settled rows avoids a visible snap.
// Mirrors interpolateYData's per-feature Y math (rem = 1 - t) so a retarget is
// seamless, and skips off-screen features the same way captureFeatureTops does.
export function captureDisplayedTops(
  target: ReadonlyMap<number, FeatureDataResult>,
  fromTops: FeatureTops,
  t: number,
): FeatureTops {
  const rem = 1 - t
  const out: FeatureTops = new Map()
  for (const data of target.values()) {
    for (const item of data.flatbushItems) {
      if (item.topPx >= 0) {
        const delta = morphDelta(fromTops, item.featureId, item.topPx) ?? 0
        out.set(item.featureId, item.topPx + delta * rem)
      }
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
    // Same delta keyed by feature id, so labels (keyed by feature/parent id, not
    // array index) reuse it without a second pass over items.
    const deltaById = new Map<string, number>()
    let moved = false
    for (let i = 0; i < items.length; i++) {
      const d = morphDelta(fromTops, items[i]!.featureId, items[i]!.topPx)
      if (d !== undefined) {
        deltas[i] = d
        deltaById.set(items[i]!.featureId, d)
        if (d !== 0) {
          moved = true
        }
      }
    }
    if (!moved || rem === 0) {
      out.set(regionIdx, data)
    } else {
      const floatingLabelsData: FeatureDataResult['floatingLabelsData'] = {}
      for (const key in data.floatingLabelsData) {
        const label = data.floatingLabelsData[key]!
        const delta = deltaById.get(label.parentFeatureId ?? label.featureId)
        floatingLabelsData[key] =
          delta === undefined
            ? label
            : { ...label, topY: label.topY + delta * rem }
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
