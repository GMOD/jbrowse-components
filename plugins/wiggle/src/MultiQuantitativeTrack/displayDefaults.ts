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

const WIGGLE_ENTRY_KEYS = ['facet', 'rows']

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
 * `displayDefaults.facet` and `.rows` on a quantitative track go onto its
 * quantitative-display entry, which keeps any it spells. The shorthand router
 * would send either to every display declaring it, the mark display among
 * them: a `facet`, the spelling `rows` replaced, would make the mark display
 * the track's first in silence rather than meet the quantitative display's
 * refusal, and the seeded `rows: 'source'` would give a mark display rows no
 * config wrote for it.
 */
export function wiggleEntryShorthand(snap: Record<string, unknown>) {
  const written = snap.displayDefaults as Record<string, unknown> | undefined
  const moved = Object.fromEntries(
    WIGGLE_ENTRY_KEYS.flatMap(key =>
      written?.[key] === undefined ? [] : [[key, written[key]]],
    ),
  )
  if (!written || Object.keys(moved).length === 0) {
    return snap
  }
  const displays = wiggleDisplays(snap)
  const wiggle = displays.find(d => d.type === 'LinearWiggleDisplay')
  return {
    ...snap,
    displayDefaults: Object.fromEntries(
      Object.entries(written).filter(([key]) => !(key in moved)),
    ),
    displays: wiggle
      ? displays.map(d => (d === wiggle ? { ...moved, ...d } : d))
      : [
          ...displays,
          {
            type: 'LinearWiggleDisplay',
            displayId: `${snap.trackId}-LinearWiggleDisplay`,
            ...moved,
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
    return wiggleEntryShorthand(
      snap.type === 'MultiQuantitativeTrack' ? seedDisplayDefaults(snap) : snap,
    )
  })
}
