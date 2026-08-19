import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { createBaseTrackConfig } from '@jbrowse/core/pluggableElementTypes'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config GCContentTrack
 * used for having a gc content track outside of the "reference sequence display"
 *
 * #example
 * A standalone `GCContentTrack` (use this instead of the
 * `ReferenceSequenceTrack` display when you want GC as its own track). The
 * sequence comes from the assembly named in `assemblyNames`, so the adapter
 * needs nothing but its type:
 * ```js
 * {
 *   type: 'GCContentTrack',
 *   trackId: 'gc',
 *   name: 'GC content',
 *   assemblyNames: ['hg38'],
 *   adapter: { type: 'GCContentAdapter' },
 * }
 * ```
 *
 * #example
 * GC-skew mode with a small, overlapping sliding window for a smoother signal
 * (`windowDelta` smaller than `windowSize` means windows overlap). The
 * `displayDefaults` object shorthand applies settings to whichever display uses
 * them — equivalent to writing a full `displays: [{ type, displayId, ... }]`
 * array. See [configuring displays](/docs/config_guides/tracks#configuring-displays):
 * ```js
 * {
 *   type: 'GCContentTrack',
 *   trackId: 'gc',
 *   name: 'GC skew',
 *   assemblyNames: ['hg38'],
 *   adapter: { type: 'GCContentAdapter' },
 *   displayDefaults: { gcMode: 'skew', windowSize: 50, windowDelta: 10 },
 * }
 * ```
 */

const configSchema = (pluginManager: PluginManager) =>
  ConfigurationSchema(
    'GCContentTrack',
    {},
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: createBaseTrackConfig(pluginManager),
    },
  )

export default configSchema
