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
// `readConnections.placement` is not among them: which side of the coverage
// the arcs hang on is a framing choice the arrangement has no opinion about, so
// applying the preset leaves it as it was and `matchesSvChannels` ignores it.
export const SV_CHANNELS_SETTINGS = {
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

/**
 * Whether settings in the config's own shape, the display's resolved values or
 * a figure spec's, are the arrangement. A spec may spell the facet as its field.
 */
export function matchesSvChannels(settings: Record<string, unknown>) {
  const on = SV_CHANNELS_SETTINGS
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
