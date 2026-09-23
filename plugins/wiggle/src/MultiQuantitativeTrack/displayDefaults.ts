import type PluginManager from '@jbrowse/core/PluginManager'

// What a MultiQuantitativeTrack asks of the one quantitative display, which a
// QuantitativeTrack does not. The display's own defaults are the single-source
// picture — one plot box, whiskers, 100px — because that is what a
// `QuantitativeTrack` with no display settings at all has always drawn.
//
// The track types differ in adapter shorthand and add-track workflow, not in
// what they draw, so this is the whole of the difference: several files arrive
// as several rows, averaged, in a taller track.
const DEFAULTS: Record<string, unknown> = {
  rows: 'source',
  summaryScoreMode: 'avg',
  height: 200,
}

const QUANTITATIVE_TRACK_TYPES = new Set([
  'QuantitativeTrack',
  'MultiQuantitativeTrack',
])

function wiggleDisplays(snap: Record<string, unknown>) {
  return Array.isArray(snap.displays)
    ? (snap.displays as Record<string, unknown>[])
    : []
}

// Seeded into `displayDefaults` rather than declared on the display: one
// display type has one set of slot defaults, and `expandTrackConfigShorthand`
// runs after this extension point, so a key the config already spells — in
// `displayDefaults` or in an explicit `displays` entry — wins.
export function seedDisplayDefaults(snap: Record<string, unknown>) {
  const written = snap.displayDefaults as Record<string, unknown> | undefined
  const spelled = new Set([
    ...Object.keys(written ?? {}),
    ...wiggleDisplays(snap)
      .filter(d => d.type === 'LinearWiggleDisplay')
      .flatMap(d => Object.keys(d)),
  ])
  const missing = Object.entries(DEFAULTS).filter(([key]) => !spelled.has(key))
  return missing.length === 0
    ? snap
    : {
        ...snap,
        displayDefaults: { ...Object.fromEntries(missing), ...written },
      }
}

/**
 * `displayDefaults.facet` on a quantitative track is the spelling `rows`
 * replaced. The shorthand router sends a key to every display declaring it,
 * and the mark display still declares `facet`, so left alone the key would
 * land there in silence and make the mark display the track's first. Moved
 * onto an explicit quantitative-display entry instead, it meets that display's
 * own refusal, which names `rows`.
 */
export function refuseFacetShorthand(snap: Record<string, unknown>) {
  const written = snap.displayDefaults as Record<string, unknown> | undefined
  if (!written || written.facet === undefined) {
    return snap
  }
  const { facet, ...rest } = written
  const displays = wiggleDisplays(snap)
  const wiggle = displays.find(d => d.type === 'LinearWiggleDisplay')
  return {
    ...snap,
    displayDefaults: rest,
    displays: wiggle
      ? displays.map(d => (d === wiggle ? { ...d, facet } : d))
      : [
          ...displays,
          {
            type: 'LinearWiggleDisplay',
            displayId: `${snap.trackId}-LinearWiggleDisplay`,
            facet,
          },
        ],
  }
}

export default function MultiQuantitativeTrackDefaultsF(
  pluginManager: PluginManager,
) {
  pluginManager.addToExtensionPoint('Core-preProcessTrackConfig', snap => {
    if (!QUANTITATIVE_TRACK_TYPES.has(snap.type as string)) {
      return snap
    }
    const checked = refuseFacetShorthand(snap)
    return snap.type === 'MultiQuantitativeTrack'
      ? seedDisplayDefaults(checked)
      : checked
  })
}
