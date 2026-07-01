import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'
import { baseLinearDisplayConfigSchema } from '@jbrowse/plugin-linear-genome-view'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config LinearHicDisplay
 * #category display
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
 * auto-picked binsize; negative = finer, positive = coarser). The
 * `displayDefaults` object shorthand applies settings to whichever display uses
 * them — equivalent to a full `displays: [{ type, displayId, ... }]` array. See
 * [configuring displays](/docs/config_guides/tracks#configuring-displays):
 * ```js
 * {
 *   type: 'HicTrack',
 *   trackId: 'hic',
 *   name: 'Hi-C',
 *   assemblyNames: ['hg38'],
 *   adapter: { type: 'HicAdapter', uri: 'https://example.com/contacts.hic' },
 *   displayDefaults: { useLogScale: true, resolutionBias: 1 },
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
      /**
       * #slot
       */
      colorScheme: {
        type: 'stringEnum',
        model: types.enumeration('HicColorScheme', [
          'fall',
          'juicebox',
          'viridis',
        ]),
        defaultValue: 'juicebox',
        description: 'color ramp used to render contact intensity',
      },
      /**
       * #slot
       */
      showLegend: {
        type: 'boolean',
        defaultValue: false,
        description: 'show the color scale legend',
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
