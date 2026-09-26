import { moveDisplayDefaults } from '@jbrowse/display-kit/retiredSettings'

import type PluginManager from '@jbrowse/core/PluginManager'

const QUANTITATIVE_TRACK_TYPES = new Set([
  'QuantitativeTrack',
  'MultiQuantitativeTrack',
])

/**
 * `displayDefaults.facet` and `.rows` on a quantitative track go onto its
 * quantitative-display entry, which keeps any it spells. The shorthand router
 * would send either to every display declaring it, the mark display among
 * them: a `facet`, the spelling `rows` replaced, would make the mark display
 * the track's first in silence rather than meet the quantitative display's
 * refusal, and a `rows` written for the plot would give a mark display rows no
 * config wrote for it.
 */
export function wiggleEntryShorthand(snap: Record<string, unknown>) {
  return moveDisplayDefaults(snap, 'LinearWiggleDisplay', ['facet', 'rows'])
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
