import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { createBaseTrackConfig } from '@jbrowse/core/pluggableElementTypes'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config HicTrack
 * #category track
 *
 * #example
 * A minimal `HicTrack` config. See the
 * [Hi-C track guide](/docs/config_guides/hic_track) for all options:
 * ```js
 * {
 *   type: 'HicTrack',
 *   trackId: 'hic',
 *   name: 'Hi-C',
 *   assemblyNames: ['hg38'],
 *   adapter: { type: 'HicAdapter', uri: 'https://example.com/contacts.hic' },
 * }
 * ```
 *
 * #example
 * With log scale and a coarser resolution (`resolutionBias` nudges the
 * auto-picked binsize; negative = finer, positive = coarser). The `displays`
 * object shorthand applies settings to whichever display uses them — equivalent
 * to a full `displays: [{ type, displayId, ... }]` array. See
 * [configuring displays](/docs/config_guides/tracks#configuring-displays):
 * ```js
 * {
 *   type: 'HicTrack',
 *   trackId: 'hic',
 *   name: 'Hi-C',
 *   assemblyNames: ['hg38'],
 *   adapter: { type: 'HicAdapter', uri: 'https://example.com/contacts.hic' },
 *   displays: { useLogScale: true, resolutionBias: 1 },
 * }
 * ```
 */

const configSchema = (pluginManager: PluginManager) =>
  ConfigurationSchema(
    'HicTrack',
    {},
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: createBaseTrackConfig(pluginManager),
    },
  )

export default configSchema
