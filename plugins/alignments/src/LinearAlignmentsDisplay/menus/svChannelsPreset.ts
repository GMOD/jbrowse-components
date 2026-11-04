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

export const PRESETS_LABEL = 'Presets'

export const SV_CHANNELS_LABEL = 'SV channels'

// One band per SV channel, each with its own coverage, its evidence reads and
// their arcs, concordant pairs' arcs left out. The filter draws only SV
// evidence and leaves every band's coverage counting all its reads (ADR-259),
// so "No SV evidence" draws its depth alone. Every setting is reachable from
// the other menus; the preset exists because six of them spread across four
// menus is not an arrangement anyone finds by looking. The menu row writes
// the filter by field (`setFilterFields`), so the fields the reader already
// filters stay, and `pileup.show` undoes the earlier preset's hidden pileup.
//
// `encoding.color` is deliberately NOT among them: the evidence reads keep
// whatever the reader colors them by.
//
// `readConnections.placement` is not among them: which side of the coverage
// the arcs hang on is a framing choice the arrangement has no opinion about, so
// applying the preset leaves it as it was and `matchesSvChannels` ignores it.
export const SV_CHANNELS_SETTINGS = {
  pileup: { show: true },
  facet: { field: 'svChannel' },
  filter: [{ field: 'svSignal', equal: true }],
  readConnections: {
    show: true,
    mark: 'link',
    ordinaryPairs: { show: false },
  },
  // Each band's read arcs already draw its split junctions, merged on their
  // exact coordinates; sashimi over the same coverage would draw each again.
  sashimi: { show: false },
} as const

// A filter keeping only SV evidence, as an entry or its bare-string shorthand
function keepsOnlySvEvidence(filter: unknown) {
  return (
    Array.isArray(filter) &&
    filter.some(
      entry =>
        entry === 'svSignal' ||
        (member(entry, 'field') === 'svSignal' &&
          member(entry, 'equal') === true),
    )
  )
}

/**
 * Whether settings in the config's own shape, the display's resolved values or
 * a figure spec's, are the arrangement. A spec may spell the facet as its field.
 */
export function matchesSvChannels(settings: Record<string, unknown>) {
  const on = SV_CHANNELS_SETTINGS
  const { facet, filter, pileup, readConnections, sashimi } = settings
  return (
    member(pileup, 'show') === on.pileup.show &&
    member(sashimi, 'show') === on.sashimi.show &&
    (typeof facet === 'string' ? facet : member(facet, 'field')) ===
      on.facet.field &&
    keepsOnlySvEvidence(filter) &&
    member(readConnections, 'show') === on.readConnections.show &&
    markType(member(readConnections, 'mark')) === on.readConnections.mark &&
    member(member(readConnections, 'ordinaryPairs'), 'show') ===
      on.readConnections.ordinaryPairs.show
  )
}
