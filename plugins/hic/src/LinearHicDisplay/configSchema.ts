import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { trackHeightConfigSchemaFields } from '@jbrowse/display-kit/trackHeightConfigSchemaFields'

import { hicColorConfigSchema } from './hicColorConfigSchema.ts'

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
 * With a log colour scale and a coarser resolution (`resolutionBias` nudges the
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
 *   displayDefaults: { color: { scale: 'log' }, resolutionBias: 1 },
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
       * #slot color
       * How a count becomes a colour: a `linear` or `log` scale onto a named
       * `scheme` or the stops in `range`.
       */
      color: hicColorConfigSchema,
      /**
       * #slot
       */
      showLegend: {
        type: 'boolean',
        description: 'show the color scale legend. Defaults to off',
        defaultValue: false,
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
