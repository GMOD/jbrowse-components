import { isPlacedRow } from './rowPlacement.ts'

import type { FeatureDataResult } from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { AnimationMode } from '@jbrowse/core/util'

// Duration of the feature-Y transition played when the layout re-packs rows
// (e.g. on a zoom step) so features ease into their new row instead of jumping.
export const MORPH_DURATION_MS = 300

// Above this many rect primitives, skip the per-frame interpolate + re-upload
// and snap instead — the animation isn't worth the GPU churn on dense views.
const MORPH_MAX_RECTS = 20000

// featureId -> row top (px) for the layout being animated away from. Keyed by
// id (not array index) so the transition survives a re-fetch: a zoom rebuilds
// the primitive arrays, but the same features keep their ids.
type FeatureTops = Map<string, number>

export function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

// A layout nothing is morphing away from: the default source for
// `captureFeatureTops`, so a settled capture and a mid-flight one are the same
// walk with an empty table rather than two functions to keep in step.
const NO_TOPS: FeatureTops = new Map()

// How far a feature should ease during a morph: its old row top minus its new
// one. `undefined` when the feature has no previous row (newly appeared — leave
// it at its destination) or when the packer left it unplaced in the target
// (`isPlacedRow` — don't sweep it toward the ~-1e6 sentinel). The single guard
// both morph directions and the displayed-top capture share, so they can't drift.
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

// How far one feature's glyph is currently drawn from its `targetTop` row, with
// `t` of the morph elapsed: the same `delta * (1 - t)` every Y in
// `interpolateYData` is shifted by, for a caller that wants one feature rather
// than a whole interpolated map. 0 when nothing is easing this feature.
//
// The DOM overlay boxes (hover, selection, solo, search) read this: their
// geometry comes from the settled `laidOutDataMap`, so without it a highlight
// sits on the destination row while the glyph it frames is still on its way
// there. Per drawn box — a handful — rather than re-deriving the interpolated
// map they'd otherwise have to index into.
export function morphOffset(
  fromTops: FeatureTops,
  featureId: string,
  targetTop: number,
  t: number,
) {
  return (morphDelta(fromTops, featureId, targetTop) ?? 0) * (1 - t)
}

// Everything that fixes a feature's row *height* and vertical *offset*, as a
// comparable key. Two layouts with equal signatures differ only in row
// *assignment* — a same-scale zoom re-pack — so their rows can morph one into the
// other; a changed signature rescaled the rows (a display-mode / label / fit-level
// change, or a fit squeeze), so the new layout must snap in. Reads the *rendered*
// label/description flags, not the raw config: in fit mode a zoom step can cross a
// fitStage level boundary that drops descriptions or names — rescaling rows —
// without either raw config flag changing, so keying on the raw flags would morph
// across rescaled rows.
//
// The rendered flags alone do NOT separate every rung, which is why the fit
// stage rides here too. `labels` and `decimated` both render names and drop
// descriptions, and in normal display mode both scale to exactly 1 — so they
// produced the identical key while the `decimated` rung strips a name row off
// roughly half the features. `labelRoomFactor` is the same hazard one level in:
// two `decimated` stacks at different factors keep different names, so the rung
// alone is not enough (a fit drag-resize re-solves it every frame).
export function rowGeometrySignature(g: {
  displayMode: string
  renderedShowLabels: boolean
  renderedShowDescriptions: boolean
  fitScale: number
  fitLevel: string
  labelRoomFactor: number | undefined
}) {
  return [
    g.displayMode,
    g.renderedShowLabels,
    g.renderedShowDescriptions,
    g.fitScale,
    g.fitLevel,
    g.labelRoomFactor,
  ].join('|')
}

// Snapshot each on-screen feature's top by id. Used both as the start of a
// later morph and to seed the next re-pack's insertion order (layout.ts).
// Features the packer left unplaced (overflowed maxHeight — see `isPlacedRow`)
// are skipped so a feature that was overflowed in the old layout and lands
// on-screen in the new one isn't animated flying in from ~-1e6, nor sorted ahead
// of genuinely on-screen features when seeding.
//
// `fromTops`/`t` describe a morph already in flight *over* `map`: given them,
// each feature is captured where it is presently DISPLAYED — eased `t` of the way
// from `fromTops` toward its row here — rather than at that settled row. That is
// what re-seeds a morph interrupted mid-flight by a second layout change (a pin
// toggle or region flip, neither debounced like zoom): starting the new morph
// from the live positions instead of the settled ones avoids a visible snap.
// Omit them — the settled case — and every feature is captured at its own row,
// since an empty `fromTops` eases nothing. One walk, so the two cannot drift.
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

// Whether a morph may play at all, before anything about the layout is
// consulted: a frame clock has to exist, and the resolved animation mode has to
// allow motion — 'enabled' always does, 'disabled' never does, and 'system'
// honors the OS prefers-reduced-motion setting, so reduced-motion users get
// instant snaps unless they explicitly opt in. The mode comes from the session
// preference (configuration.preferences.animationMode + user override).
//
// Lives beside `canMorph` (the layout half of the same question) rather than in
// the model, which is where it used to sit — it reads no model state, and the
// two are always asked together.
export function morphAllowed(mode: AnimationMode) {
  const hasFrameClock = typeof requestAnimationFrame === 'function'
  const prefersReduced =
    typeof matchMedia === 'function' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches
  return (
    hasFrameClock &&
    (mode === 'enabled' || (mode === 'system' && !prefersReduced))
  )
}

// The clock a morph is timed against — the stamp `beginYMorph` takes and the
// reading the frame loop measures against it, so that both come from here and
// cannot be two different clocks. Guarded for environments without
// `performance` (jsdom sub-environments, node RPC workers importing this file
// transitively), which fall back to the epoch clock rather than to a constant:
// a clock that never advances leaves the frame loop rescheduling itself at
// progress 0 forever. Paired with `morphAllowed` above so both of the model's
// environment probes sit in one place.
export function morphClockMs() {
  return typeof performance === 'undefined' ? Date.now() : performance.now()
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
