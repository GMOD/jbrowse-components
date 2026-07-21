// Shared track-height vocabulary for displays that expose a promotable
// `heightMode` config slot (the canvas feature display and the alignments
// display). Keeping the enum members, the resolved type, and the grow ceiling in
// one place keeps the two plugins' modes identical rather than drifting.

// Config-slot enum members. `inherit` is the promotable sentinel (the inherit
// state that resolves through the session-default cascade); the rest are the
// real, concrete modes.
export const HEIGHT_MODE_VALUES = ['inherit', 'fixed', 'grow', 'fit'] as const

// What a resolved `heightMode` getter (getConf) returns — never the
// `inherit` sentinel. `fixed` scrolls, `grow` resizes the track to fit all
// content, `fit` shrinks content to fill the current height.
export type HeightMode = 'fixed' | 'grow' | 'fit'

// Display-height ceiling for `grow` mode, in px, so a deep pileup / dense track
// doesn't grow the track to thousands of px. Content past this scrolls, the same
// as `fixed`. Distinct from the per-display `maxHeight` slot, which caps layout
// stacking (how much content is laid out), not the on-screen track height.
export const GROW_MAX_HEIGHT = 800

// Single source for the "Track sizing" radio options, shared by every display
// that exposes the `heightMode` slot (canvas feature display, alignments
// display). Each label names the two axes it touches — the per-feature height
// and the track height — so the three modes read as one coherent choice:
// `fixed` keeps the feature height and scrolls; `grow` keeps the same feature
// height but autogrows the track to hold it; `fit` derives the feature height
// to fill the display. The shared "Fixed <noun> height" prefix on the first two
// makes explicit that `grow` differs from `fixed` only in the track axis, and
// naming "height" is honest here — `fit` genuinely drives the per-feature size,
// so the two axes aren't fully orthogonal. `noun` is the SINGULAR of what the
// track holds ('feature', 'read'); everything else stays identical across
// plugins.
export function getHeightModeOptions(
  noun: string,
): { value: HeightMode; label: string }[] {
  return [
    { value: 'fixed', label: `Fixed ${noun} height` },
    { value: 'grow', label: `Fixed ${noun} height + autogrow track height` },
    { value: 'fit', label: `Fit ${noun} height to display` },
  ]
}
