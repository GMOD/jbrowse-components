// The SV-channel arrangement, kept in a leaf module with no UI imports so it can
// be read by things that must not pull in React — here, the website's figure
// recipes, which name a figure's arrangement by its menu label. Same reason
// compactnessPresets.ts is its own module.

function member(value: unknown, key: string) {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)[key]
    : undefined
}

// A mark written as its bare type or as the object.
function markType(mark: unknown) {
  return typeof mark === 'string' ? mark : member(mark, 'type')
}

export const SV_CHANNELS_LABEL = 'SV channels'

// One band per SV channel, each with its own coverage and its own arcs,
// concordant pairs' arcs left out. Every setting is reachable from the other menus;
// the preset exists because five of them spread across three menus is not an
// arrangement anyone finds by looking.
//
// `encoding.color` is deliberately NOT among them. With the pileup hidden there are no
// read fills to paint, and the coverage band reads the color only under a
// modification or bisulfite field (executeRenderAlignmentData's
// `modCoverage`).
//
// `readConnections.placement` is in NEITHER preset, and that is the same
// statement `isSvChannelsActive` makes by not matching on it: which side of the
// coverage the arcs hang on is a framing choice the arrangement has no opinion
// about. Writing it was the read and the write disagreeing — flipping the side
// kept the row ticked, then leaving and re-entering silently reverted the flip.
export const SV_CHANNELS_ON = {
  pileup: { show: false },
  facet: { field: 'svChannel' },
  readConnections: {
    show: true,
    mark: 'link',
    ordinaryPairs: { show: false },
  },
  // Each band's read arcs already draw its split junctions, merged on their
  // exact coordinates; sashimi over the same coverage would draw each again.
  sashimi: { show: false },
} as const

// Leaving the arrangement UNSETS what it wrote rather than asserting a state:
// each member goes back to its default, and `readConnections.mark` stays as
// it was.
//
// It is still not a restore — a tag grouping or a read cloud in place before
// the row was ticked does not come back, since nothing banks what it displaced.
export const SV_CHANNELS_OFF = {
  pileup: { show: null },
  facet: null,
  readConnections: { show: null, ordinaryPairs: { show: null } },
  sashimi: { show: null },
} as const

/**
 * Whether settings in the config's own shape, the display's resolved values or
 * a figure spec's, are the arrangement. A spec may spell the facet as its field.
 */
export function isSvChannelsActive(settings: Record<string, unknown>) {
  const on = SV_CHANNELS_ON
  const { facet, pileup, readConnections, sashimi } = settings
  return (
    member(pileup, 'show') === on.pileup.show &&
    member(sashimi, 'show') === on.sashimi.show &&
    (typeof facet === 'string' ? facet : member(facet, 'field')) ===
      on.facet.field &&
    member(readConnections, 'show') === on.readConnections.show &&
    markType(member(readConnections, 'mark')) === on.readConnections.mark &&
    member(member(readConnections, 'ordinaryPairs'), 'show') ===
      on.readConnections.ordinaryPairs.show
  )
}
