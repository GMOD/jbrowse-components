// Shared track-height vocabulary for displays that expose a promotable
// `heightMode` config slot (the canvas feature display and the alignments
// display). Keeping the enum members, the resolved type, and the grow ceiling in
// one place keeps the two plugins' modes identical rather than drifting.

// Config-slot enum members. `inherit` is the promotable sentinel (the un-pinned
// state that resolves through the session-default cascade); the rest are the
// real, concrete modes.
export const HEIGHT_MODE_VALUES = ['inherit', 'fixed', 'grow', 'fit'] as const

// What a resolved `heightMode` getter (getConfResolved) returns — never the
// `inherit` sentinel. `fixed` scrolls, `grow` resizes the track to fit all
// content, `fit` shrinks content to fill the current height.
export type HeightMode = 'fixed' | 'grow' | 'fit'

// Display-height ceiling for `grow` mode, in px, so a deep pileup / dense track
// doesn't grow the track to thousands of px. Content past this scrolls, the same
// as `fixed`. Distinct from the per-display `maxHeight` slot, which caps layout
// stacking (how much content is laid out), not the on-screen track height.
export const GROW_MAX_HEIGHT = 800

// Single source for the "Track height" radio options and their effect-describing
// labels, shared by every display that exposes the `heightMode` slot (canvas
// feature display, alignments display) so a first-time user reads the effect
// instead of parsing `fixed`/`grow`/`fit`, and the wording can't drift between
// plugins. `noun` names what the track holds ('features', 'reads'); everything
// else stays identical.
export function getHeightModeOptions(
  noun: string,
): { value: HeightMode; label: string }[] {
  return [
    { value: 'fixed', label: `Fixed height — scroll to see all ${noun}` },
    { value: 'grow', label: `Auto height — grow to fit all ${noun}` },
    { value: 'fit', label: `Compressed — squeeze all ${noun} into view` },
  ]
}
