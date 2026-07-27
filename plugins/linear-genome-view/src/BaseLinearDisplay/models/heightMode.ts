// Shared track-height vocabulary for displays that expose a promotable
// `heightMode` config slot (the canvas feature display and the alignments
// display). Keeping the enum members, the resolved type, and the grow ceiling in
// one place keeps the two plugins' modes identical rather than drifting.

// Config-slot enum members: the real modes only. The slot is a promotable
// `maybeStringEnum`, so the inherit state is the slot being unset, not a member
// here — the vocabulary stays free of the cascade's plumbing.
export const HEIGHT_MODE_VALUES = ['fixed', 'grow', 'fit'] as const

// What a resolved `heightMode` getter (getConf) returns. `fixed` scrolls, `grow`
// resizes the track to fit all content, `fit` shrinks content to fill the
// current height.
export type HeightMode = (typeof HEIGHT_MODE_VALUES)[number]

// Default for the `growMaxHeight` config slot: the display-height ceiling for
// `grow` mode, in px, so a deep pileup / dense track doesn't grow the track to
// thousands of px. Content past this scrolls, the same as `fixed`. It is a slot
// rather than a constant because 800px is a guess about screen real estate, not
// a property of the data — at real Illumina depth a pileup passes it in the
// first hundred rows, and from there "autogrow" is indistinguishable from a
// fixed 800px track. Distinct from each display's own `maxHeight` slot, which
// bounds how much content is laid out / clamped, not the grow ceiling.
export const GROW_MAX_HEIGHT = 800

// Single source for the "Track sizing" radio options, shared by every display
// that exposes the `heightMode` slot (canvas feature display, alignments
// display). The three modes are three cells of a 2x2 over the per-feature
// height axis and the track height axis (both-derived is incoherent, so there
// is no fourth), and every label names BOTH cells rather than leaving one to be
// inferred. That makes each row read as `read axis + track axis`:
//
//   fixed  Fixed <noun> height + fixed track height      (overflow scrolls)
//   grow   Fixed <noun> height + autogrow track height   (track follows content)
//   fit    Fit <noun> height to track height             (size is derived)
//
// The first two share the "Fixed <noun> height" prefix verbatim, so they read as
// the same answer on the feature axis differing in exactly one word. `fit`
// breaks the prefix at the word that matters, and collapses to one clause
// because "fit A to B" already says B is the fixed one. Naming "height" on both
// sides is honest: `fit` genuinely drives the per-feature size, so the two axes
// aren't fully orthogonal. `noun` is the SINGULAR of what the track holds
// ('feature', 'read'); everything else stays identical across plugins.
const HEIGHT_MODE_LABELS: Record<HeightMode, (noun: string) => string> = {
  fixed: noun => `Fixed ${noun} height + fixed track height`,
  grow: noun => `Fixed ${noun} height + autogrow track height`,
  fit: noun => `Fit ${noun} height to track height`,
}

// One mode's label. A total lookup over the mode union, so callers that already
// know which mode they mean (a docs figure boxing the `fit` row) don't have to
// search the option list and handle a miss that can't happen.
export function heightModeLabel(mode: HeightMode, noun: string) {
  return HEIGHT_MODE_LABELS[mode](noun)
}

export function getHeightModeOptions(
  noun: string,
): { value: HeightMode; label: string }[] {
  return HEIGHT_MODE_VALUES.map(value => ({
    value,
    label: heightModeLabel(value, noun),
  }))
}
