import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { triangleMatrixConfigSchemaFields } from '@jbrowse/display-kit/TriangleMatrixMixin'
import { retiredBaseDisplaySpellings } from '@jbrowse/display-kit/configSchema'
import { fieldPredicateList } from '@jbrowse/display-kit/fieldPredicateConfigSchema'
import { hiddenLegendConfigSchema } from '@jbrowse/display-kit/hiddenLegendConfigSchema'
import { trackHeightConfigSchemaFields } from '@jbrowse/display-kit/trackHeightConfigSchemaFields'

import { hicDataConfigSchema } from './hicDataConfigSchema.ts'
import { hicEncodingConfigSchema } from './hicEncodingConfigSchema.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config LinearHicDisplay
 * #category display
 * Draws a `HicTrack`'s contact matrix as a triangular heatmap in the linear
 * genome view, at a bin size that follows the zoom.
 *
 * #example
 * A log color scale, one binsize coarser than the zoom picks, through the
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
 *     data: { resolution: -1 },
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
       * #slot data
       * What the fetch reads, a [](/docs/config/hicdata) object: `resolution`
       * steps the binsize from the zoom's pick, `normalization` names the
       * matrix normalization.
       */
      data: hicDataConfigSchema,
      /**
       * #slot filter
       * Floors, written `gte` or `gt`, on the counts a cell is built from:
       * `observed`, the map's count, and under observed/control `control`,
       * the control's, both before the depth scaling. A cell below a floor is
       * left out before its ratio, so a ratio of two near-empty bins does not
       * speckle the triangle. A floor on `observed` alone drops the contacts
       * a condition lost; floor `control`, or both, to keep them.
       */
      filter: fieldPredicateList(),
    },
    {
      explicitlyTyped: true,
      /**
       * #identifier
       */
      explicitIdentifier: 'displayId',
      // v4's renderer block held a base color the ramp has no member for,
      // a cap on the triangle's height and a per-cell callback into the
      // plugin's jexl functions.
      retired: {
        ...retiredBaseDisplaySpellings,
        renderer: () => ({}),
      },
    },
  )
}

export type HicTrackConfigModel = ReturnType<typeof HicTrackConfigFactory>
export type HicTrackConfig = Instance<HicTrackConfigModel>
export default HicTrackConfigFactory
