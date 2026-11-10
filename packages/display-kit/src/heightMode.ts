// Shared track-height vocabulary for displays that expose a `heightMode` config
// slot (the feature display and the alignments display). Keeping the enum
// members, the resolved type, and the grow ceiling in one place keeps the two
// plugins' modes identical rather than drifting.
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
// fixed 800px track. Distinct from alignments' `pileup.maxLayoutHeight`, which
// bounds how much content is laid out, not the grow ceiling.
export const GROW_MAX_HEIGHT = 800

export const GROW_THE_TRACK_LABEL = 'Grow the track'

// Single source for the three overflow choices, shared by the feature
// display's "When features overflow" radios and the corner track-sizing
// control. Each label answers what happens when the content doesn't fit.
const HEIGHT_MODE_LABELS: Record<HeightMode, string> = {
  fixed: 'Scroll',
  grow: GROW_THE_TRACK_LABEL,
  fit: 'Fit to track height',
}

// One mode's label. A total lookup over the mode union, so callers that already
// know which mode they mean (a docs figure boxing the `fit` row) don't have to
// search the option list and handle a miss that can't happen.
export function heightModeLabel(mode: HeightMode) {
  return HEIGHT_MODE_LABELS[mode]
}

export function getHeightModeOptions(): { value: HeightMode; label: string }[] {
  return HEIGHT_MODE_VALUES.map(value => ({
    value,
    label: heightModeLabel(value),
  }))
}
