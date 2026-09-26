import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { createBaseTrackConfig } from '@jbrowse/core/pluggableElementTypes/models'
import { types } from '@jbrowse/mobx-state-tree'
import {
  linearWiggleDisplayConfigSchema,
  summaryScoreModeConfigSchemaFields,
} from '@jbrowse/plugin-wiggle'

import type PluginManager from '@jbrowse/core/PluginManager'

const gcWiggleConfigSchema = ConfigurationSchema(
  'LinearWiggleDisplay',
  {
    ...summaryScoreModeConfigSchemaFields({
      defaultMode: 'avg',
      description:
        "a GC window has one score and no min/max to draw, so 'avg'; 'whiskers' would force one colour on every bin and draw a negative skew as positive",
    }),
  },
  { baseConfiguration: linearWiggleDisplayConfigSchema },
)

/**
 * #config GCContentTrack
 * GC content, or GC skew, of the assembly's sequence, computed as the view
 * moves by a `GCContentAdapter` and drawn by the wiggle display. The adapter
 * holds the window, the step and the mode; the track menu's GC parameters and
 * GC skew write them there. The reference sequence track's menu has "Add GC
 * content track", which makes one.
 *
 * #example
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
 * GC skew over a small, overlapping sliding window for a smoother signal
 * (`windowDelta` under `windowSize` overlaps the windows):
 * ```js
 * {
 *   type: 'GCContentTrack',
 *   trackId: 'gc_skew',
 *   name: 'GC skew',
 *   assemblyNames: ['hg38'],
 *   adapter: {
 *     type: 'GCContentAdapter',
 *     gcMode: 'skew',
 *     windowSize: 50,
 *     windowDelta: 10,
 *   },
 * }
 * ```
 */
const configSchema = (pluginManager: PluginManager) =>
  ConfigurationSchema(
    'GCContentTrack',
    {
      /**
       * #slot
       * As on [every track](../basetrack#slot-displays), except that a
       * `LinearWiggleDisplay` entry defaults to `summaryScoreMode: 'avg'`.
       */
      displays: types.array(
        types.union(
          ...pluginManager
            .getDisplayElements()
            .map(d =>
              d.configSchema === linearWiggleDisplayConfigSchema
                ? gcWiggleConfigSchema
                : d.configSchema,
            ),
        ),
      ),
    },
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: createBaseTrackConfig(pluginManager),
    },
  )

export default configSchema
