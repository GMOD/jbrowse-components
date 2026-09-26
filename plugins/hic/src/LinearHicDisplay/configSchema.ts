import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { triangleMatrixConfigSchemaFields } from '@jbrowse/display-kit/TriangleMatrixMixin'
import { trackHeightConfigSchemaFields } from '@jbrowse/display-kit/trackHeightConfigSchemaFields'

import { hicColorConfigSchema } from './hicColorConfigSchema.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config LinearHicDisplay
 * #category display
 *
 * #example
 * A log colour scale, one step coarser than the zoom picks, through the
 * `displayDefaults` shorthand. See the
 * [Hi-C track guide](/docs/config_guides/hic_track) for the rest:
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
      ...triangleMatrixConfigSchemaFields,
      /**
       * #slot color
       * How a count becomes a colour: a `linear` or `log` scale onto a named
       * `scheme`, over a domain whose unset ends follow the loaded counts.
       */
      color: hicColorConfigSchema,
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
      showResolutionControls: {
        type: 'boolean',
        defaultValue: false,
        description: 'show the on-figure resolution dropdown in the overlay',
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
      retired: {
        // eslint-disable-next-line @eslint-react/no-unnecessary-use-prefix -- the retired slot's own name
        useColorPercentile: follows => ({
          color: { autoscale: follows ? 'localpercentile' : 'local' },
        }),
      },
    },
  )
}

export type HicTrackConfigModel = ReturnType<typeof HicTrackConfigFactory>
export type HicTrackConfig = Instance<HicTrackConfigModel>
export default HicTrackConfigFactory
