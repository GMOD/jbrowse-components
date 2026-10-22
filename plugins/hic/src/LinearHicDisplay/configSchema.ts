import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { triangleMatrixConfigSchemaFields } from '@jbrowse/display-kit/TriangleMatrixMixin'
import { retiredBaseDisplaySpellings } from '@jbrowse/display-kit/configSchema'
import { hiddenLegendConfigSchema } from '@jbrowse/display-kit/legendConfigSchema'
import { trackHeightConfigSchemaFields } from '@jbrowse/display-kit/trackHeightConfigSchemaFields'

import { hicEncodingConfigSchema } from './hicColorConfigSchema.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config LinearHicDisplay
 * #category display
 * Draws a `HicTrack`'s contact matrix as a triangular heatmap in the linear
 * genome view, at a bin size that follows the zoom.
 *
 * #example
 * A log color scale, one step coarser than the zoom picks, through the
 * `displayDefaults` shorthand. See the
 * [Hi-C track guide](/docs/config_guides/hic_track) for the rest:
 * ```js
 * {
 *   type: 'HicTrack',
 *   trackId: 'hic',
 *   name: 'Hi-C',
 *   assemblyNames: ['hg38'],
 *   adapter: { type: 'HicAdapter', uri: 'https://example.com/contacts.hic' },
 *   displayDefaults: {
 *     encoding: { color: { scale: { type: 'symlog' } } },
 *     resolutionBias: 1,
 *   },
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
      ...triangleMatrixConfigSchemaFields,
      /**
       * #slot encoding
       * The channels the bins paint through: `encoding.color`, the scale from
       * count to color.
       */
      encoding: hicEncodingConfigSchema,
      /**
       * #slot legend
       * The color ramp's key, off until asked for.
       */
      legend: hiddenLegendConfigSchema,
      /**
       * #slot
       */
      resolutionBias: {
        type: 'number',
        defaultValue: 0,
        description:
          'steps from the zoom-picked binsize: -1 one finer, +1 one coarser, 0 follows the zoom',
      },
      /**
       * #slot
       */
      selectedNormalization: {
        type: 'string',
        defaultValue: 'KR',
        description:
          'preferred matrix normalization (KR, SCALE, VC, VC_SQRT, NONE); a scheme the file lacks falls back to one it has',
      },
    },
    {
      explicitlyTyped: true,
      /**
       * #identifier
       */
      explicitIdentifier: 'displayId',
      // v4's renderer block held a base color the ramp has no member for,
      // a cap on the triangle's height and a per-cell callback into the
      // plugin's jexl functions. The on-figure binsize dropdown gave way to
      // the legend title naming the binsize.
      retired: {
        ...retiredBaseDisplaySpellings,
        renderer: () => ({}),
        showResolutionControls: () => ({}),
      },
    },
  )
}

export type HicTrackConfigModel = ReturnType<typeof HicTrackConfigFactory>
export type HicTrackConfig = Instance<HicTrackConfigModel>
export default HicTrackConfigFactory
