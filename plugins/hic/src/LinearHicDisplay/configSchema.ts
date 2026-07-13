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
      /**
       * #slot
       * Signed integer offset from the zoom-derived auto-picked binsize. `0`
       * means pure auto; `-1` is one step finer, `+1` one step coarser. Tracking
       * the offset (not an absolute binsize) keeps the intent valid across zoom.
       */
      resolutionBias: {
        type: 'number',
        defaultValue: 0,
        description: 'offset from the auto-picked resolution binsize',
      },
      /**
       * #slot
       */
      useLogScale: {
        type: 'boolean',
        defaultValue: false,
        description: 'map contact counts to color on a log2 scale',
      },
      /**
       * #slot
       * false → maxScore/20 (linear) or maxScore (log); true → 95th percentile
       * of counts, so off-diagonal contacts read more strongly.
       */
      useColorPercentile: {
        type: 'boolean',
        defaultValue: false,
        description: 'saturate color at the 95th percentile of counts',
      },
      /**
       * #slot
       */
      showResolutionControls: {
        type: 'boolean',
        defaultValue: true,
        description: 'show the on-figure resolution stepper in the overlay',
      },
      /**
       * #slot
       * The user's chosen matrix normalization scheme (e.g. KR, SCALE, VC,
       * NONE). Resolved at runtime against what the `.hic` file actually
       * provides — see the model's `activeNormalization` getter.
       */
      selectedNormalization: {
        type: 'string',
        defaultValue: 'KR',
        description: 'preferred matrix normalization scheme',
      },
      /**
       * #slot
       */
      fitToHeight: {
        type: 'boolean',
        defaultValue: false,
        description:
          'squash the triangle vertically to fit the display height instead of drawing square bins',
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
