import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { baseLinearDisplayConfigSchema } from '@jbrowse/plugin-linear-genome-view'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config LinearHicDisplay
 * #category display
 *
 * #example
 * A minimal `HicTrack` config:
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
 * to a full `displays: [{ type, displayId, ... }]` array:
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

const HicTrackConfigFactory = () => {
  return ConfigurationSchema(
    'LinearHicDisplay',
    {
      /**
       * #slot
       */
      height: {
        type: 'number',
        defaultValue: 300,
        description: 'default height for the Hi-C track',
      },
    },
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: baseLinearDisplayConfigSchema,
      explicitlyTyped: true,
    },
  )
}

export type HicTrackConfigModel = ReturnType<typeof HicTrackConfigFactory>
export type HicTrackConfig = Instance<HicTrackConfigModel>
export default HicTrackConfigFactory
