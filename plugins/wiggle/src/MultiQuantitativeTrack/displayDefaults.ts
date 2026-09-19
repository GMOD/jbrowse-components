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
  facet: 'source',
  summaryScoreMode: 'avg',
  height: 200,
}

// Seeded into `displayDefaults` rather than declared on the display: one
// display type has one set of slot defaults, and `expandTrackConfigShorthand`
// runs after this extension point, so a key the config already spells — in
// `displayDefaults` or in an explicit `displays` entry — wins.
function seed(snap: Record<string, unknown>) {
  const written = snap.displayDefaults as Record<string, unknown> | undefined
  const displays = Array.isArray(snap.displays)
    ? (snap.displays as Record<string, unknown>[])
    : []
  const spelled = new Set([
    ...Object.keys(written ?? {}),
    ...displays
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

export default function MultiQuantitativeTrackDefaultsF(
  pluginManager: PluginManager,
) {
  pluginManager.addToExtensionPoint('Core-preProcessTrackConfig', snap =>
    snap.type === 'MultiQuantitativeTrack' ? seed(snap) : snap,
  )
}
