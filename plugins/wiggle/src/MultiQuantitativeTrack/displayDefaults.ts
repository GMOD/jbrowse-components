import { moveDisplayDefaults } from '@jbrowse/display-kit/retiredSettings'

import type PluginManager from '@jbrowse/core/PluginManager'

const QUANTITATIVE_TRACK_TYPES = new Set([
  'QuantitativeTrack',
  'MultiQuantitativeTrack',
])

/**
 * `displayDefaults.rows` on a quantitative track goes onto its
 * quantitative-display entry, which keeps any it spells. The shorthand router
 * would send it to every display declaring it, and a `rows` written for the
 * plot would give the mark display rows no config wrote for it.
 */
export function wiggleEntryShorthand(snap: Record<string, unknown>) {
  return moveDisplayDefaults(snap, 'LinearWiggleDisplay', ['rows'])
}

export default function MultiQuantitativeTrackDefaultsF(
  pluginManager: PluginManager,
) {
  pluginManager.addToExtensionPoint('Core-preProcessTrackConfig', snap => {
    if (!QUANTITATIVE_TRACK_TYPES.has(snap.type as string)) {
      return snap
    }
    return wiggleEntryShorthand(snap)
  })
}
