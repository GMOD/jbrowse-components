// The fixed read-height vocabulary, kept in a leaf module with no UI imports so
// it can be read by things that must not pull in React — the menu itself
// (featureSize.tsx, which re-exports these), and the website's figure recipes,
// which name a figure's featureHeight by its preset label.

// Single source of truth for the fixed read-height presets — one height each
// (spacing is derived from it). Both the radios' `checked` state and their
// onClick derive from this, so adding a preset means updating one place.
//
// 'Normal' (7) is the resolved base of the featureHeight sentinel slot (its
// promotedBase), so a fresh display with no overrides reads as Normal-checked.
// Clicking any preset — Normal included — writes its exact height, which
// customizes the track (the slot is sentinel maybeNumber, so 7 is a real
// customizable value, not the inherit signal). That's what lets Normal win over
// a Compact session default; a plain-number slot would strip 7 to the default
// and re-inherit Compact. See promotableDefaults.ts.
export const COMPACTNESS_PRESETS = {
  normal: { label: 'Normal', featureHeight: 7 },
  compact: { label: 'Compact', featureHeight: 3 },
  'super-compact': { label: 'Super-compact', featureHeight: 1 },
} as const

// The one rule turning a read size into its inter-read gap: a 1px gap once
// there's room for a >2px body, else flush. Spacing is derived, never stored, so
// this is the single source both the `featureSpacing` getter (fixed body / fit
// pitch) and the fit cap (`normal pitch = body + gap`) key off — encoding it once
// keeps the presets and the fit squeeze from disagreeing.
export function featureSpacingForHeight(height: number) {
  return height > 3 ? 1 : 0
}

// The pitch a Normal read occupies (body + its derived gap). The fit squeeze
// caps here so choosing "fit" only ever shrinks reads below Normal, never
// balloons a handful past it.
export const NORMAL_PITCH =
  COMPACTNESS_PRESETS.normal.featureHeight +
  featureSpacingForHeight(COMPACTNESS_PRESETS.normal.featureHeight)
