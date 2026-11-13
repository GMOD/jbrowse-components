// The fixed read-height vocabulary, kept in a leaf module with no UI imports so
// it can be read by things that must not pull in React — the menu itself
// (featureSize.ts, which re-exports these), and the website's figure recipes,
// which name a figure's `pileup.mark.height` by its preset label.

// Single source of truth for the fixed read-height presets — one height each
// (spacing is derived from it). Both the radios' `checked` state and their
// onClick derive from this, so adding a preset means updating one place.
//
// 'Normal' (7) is `pileup.mark.height`'s default, so a fresh display with no
// overrides reads as Normal-checked. Clicking any preset writes its exact
// height.
export const COMPACTNESS_PRESETS = {
  normal: { label: 'Normal', height: 7 },
  compact: { label: 'Compact', height: 3 },
  'super-compact': { label: 'Super-compact', height: 1 },
} as const

const FLUSH_MAX_HEIGHT = COMPACTNESS_PRESETS.compact.height
const WIDE_GAP_MIN_HEIGHT = COMPACTNESS_PRESETS.normal.height

// The one rule turning a read size into its inter-read gap: 2px from a Normal
// read up, as v4 drew it, 1px once a read is taller than Compact, else flush.
// Spacing is derived, never stored; the fixed `featureSpacing` getter and the
// fit cap (`normal pitch = body + gap`) key off it.
export function featureSpacingForHeight(height: number) {
  return (
    (height > FLUSH_MAX_HEIGHT ? 1 : 0) +
    (height >= WIDE_GAP_MIN_HEIGHT ? 1 : 0)
  )
}

function unitRamp(x: number) {
  return Math.min(1, Math.max(0, x))
}

// The fit squeeze's gap for a pitch (body + gap), from the same two steps. No
// body puts its pitch in (3, 4] or [8, 9), since each step adds a pixel of gap,
// so across those spans the body holds and the gap grows: the body never
// shrinks as the track grows, and a pitch some fixed height produces splits
// back into that height and its `featureSpacingForHeight` gap.
export function featureSpacingForPitch(pitch: number) {
  return (
    unitRamp(pitch - FLUSH_MAX_HEIGHT) +
    unitRamp(pitch - WIDE_GAP_MIN_HEIGHT - 1)
  )
}

// The pitch a Normal read occupies (body + its derived gap). The fit squeeze
// caps here so choosing "fit" only ever shrinks reads below Normal, never
// balloons a handful past it.
export const NORMAL_PITCH =
  COMPACTNESS_PRESETS.normal.height +
  featureSpacingForHeight(COMPACTNESS_PRESETS.normal.height)

/** The Read height radio that fits the read height to the track. */
export const FIT_TO_TRACK_LABEL = 'Fit to track height'
