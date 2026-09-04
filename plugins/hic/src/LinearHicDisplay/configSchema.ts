import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { trackHeightConfigSchemaFields } from '@jbrowse/display-kit/trackHeightConfigSchemaFields'
import { types } from '@jbrowse/mobx-state-tree'

import {
  DEFAULT_HIC_COLOR_SCHEME,
  HIC_COLOR_SCHEMES,
} from './components/colorRamp.ts'

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
      ...trackHeightConfigSchemaFields({
        defaultHeight: 300,
        height: 'default height for the Hi-C track',
      }),
      /**
       * #slot
       */
      colorScheme: {
        type: 'stringEnum',
        model: types.enumeration('HicColorScheme', [...HIC_COLOR_SCHEMES]),
        defaultValue: DEFAULT_HIC_COLOR_SCHEME,
        description: 'color ramp used to render contact intensity',
      },
      /**
       * #slot
       */
      showLegend: {
        type: 'maybeBoolean',
        description:
          'show the color scale legend. Unset (the default) follows the session-wide default for this display type, falling back to off; an explicit true/false customizes the track',
        // Promotable: `undefined` (unset) is the inherit state, `promotedBase`
        // (false) is what it resolves to when nothing is promoted. Read through
        // the resolved `showLegend` getter (resolveConf), never raw.
        promotedBase: false,
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
        defaultValue: true,
        description: 'saturate color at the 95th percentile of counts',
      },
      /**
       * #slot
       */
      showResolutionControls: {
        type: 'boolean',
        defaultValue: false,
        description: 'show the on-figure resolution dropdown in the overlay',
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
      squashToHeight: {
        type: 'boolean',
        defaultValue: false,
        description:
          'squash the triangle vertically to fit the display height instead of drawing square bins',
      },
    },
    {
      explicitlyTyped: true,
      /**
       * #identifier
       */
      explicitIdentifier: 'displayId',
    },
  )
}

export type HicTrackConfigModel = ReturnType<typeof HicTrackConfigFactory>
export type HicTrackConfig = Instance<HicTrackConfigModel>
export default HicTrackConfigFactory
