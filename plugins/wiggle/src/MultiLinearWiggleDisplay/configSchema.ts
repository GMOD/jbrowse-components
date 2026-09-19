import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { facetConfigSchema } from '@jbrowse/display-kit/facetConfigSchema'
import { trackHeightConfigSchemaFields } from '@jbrowse/display-kit/trackHeightConfigSchemaFields'
import { types } from '@jbrowse/mobx-state-tree'
import {
  rowSeparatorsConfigSchemaFields,
  treeSidebarConfigSchemaFields,
} from '@jbrowse/tree-sidebar/treeSidebarConfigSchemaFields'

import { checkFacetField } from '../shared/checkFacetField.ts'
import { summaryScoreModeConfigSchemaFields } from '../shared/summaryScoreModeConfigSchemaFields.ts'
import {
  wiggleConfigSchemaFields,
  wiggleValueScale,
} from '../shared/wiggleConfigSchemaFields.ts'
import { WIGGLE_RENDERING_TYPES } from '../util.ts'

/**
 * #config MultiLinearWiggleDisplay
 * #category display
 * configuration for the multi-wiggle display, which draws several quantitative
 * subtracks (e.g. BigWig files) on a shared Y axis
 *
 * These are display-level slots: set them inside a track's `displays` to
 * change its defaults (setting them at the track top level has no effect).
 * The object shorthand `displayDefaults: { key: value }` is equivalent to the
 * full `displays: [{ type: 'MultiLinearWiggleDisplay', displayId: '...', key: value }]`
 * array form — see
 * [configuring displays](/docs/config_guides/tracks#configuring-displays).
 *
 * Per-subtrack metadata (a `name`, `color`, and `group` for each subtrack) is
 * preloaded on the *adapter*, not here — use `MultiWiggleAdapter`'s
 * `subadapters` slot, where `group` drives the sidebar clustering tree and
 * `color` sets each subtrack's line/fill.
 *
 * #example
 * Minimal `MultiQuantitativeTrack` config. See the
 * [multi-quantitative track guide](/docs/config_guides/multiquantitative_track)
 * for all adapter and display options:
 * ```js
 * {
 *   type: 'MultiQuantitativeTrack',
 *   trackId: 'coverage_by_sample',
 *   name: 'Coverage by sample',
 *   assemblyNames: ['hg38'],
 *   adapter: {
 *     type: 'MultiWiggleAdapter',
 *     bigWigs: [
 *       'https://example.com/sample1.bw',
 *       'https://example.com/sample2.bw',
 *     ],
 *   },
 * }
 * ```
 *
 * #example
 * Taller track overlaying two samples in one shared plot instead of the
 * default row per subtrack:
 * ```js
 * {
 *   type: 'MultiQuantitativeTrack',
 *   trackId: 'coverage_by_sample',
 *   name: 'Coverage by sample',
 *   assemblyNames: ['hg38'],
 *   adapter: {
 *     type: 'MultiWiggleAdapter',
 *     bigWigs: [
 *       'https://example.com/sample1.bw',
 *       'https://example.com/sample2.bw',
 *     ],
 *   },
 *   displayDefaults: { height: 300, facet: '' },
 * }
 * ```
 */
const configSchema = ConfigurationSchema(
  'MultiLinearWiggleDisplay',
  {
    ...wiggleConfigSchemaFields,
    /**
     * #slot scales
     * The y scale the plot is drawn through: `type`, `domainMin`,
     * `domainMax`, `autoscale`, `numStdDev`, `numQuantile` and
     * `symlogConstant`.
     */
    scales: wiggleValueScale(),
    ...trackHeightConfigSchemaFields({ defaultHeight: 200 }),
    ...summaryScoreModeConfigSchemaFields({ defaultMode: 'avg' }),
    /**
     * #slot
     * Default rendering type: `xyplot`, `density`, `line`, `linecenter`, or
     * `scatter`. Whether the subtracks share one plot or take a row each is
     * `facet`.
     * #example
     * ```json
     * {
     *   "type": "MultiLinearWiggleDisplay",
     *   "defaultRendering": "density"
     * }
     * ```
     */
    defaultRendering: {
      type: 'stringEnum',
      model: types.enumeration('Rendering', [...WIGGLE_RENDERING_TYPES]),
      defaultValue: 'xyplot',
      description: 'Default rendering type',
    },
    /**
     * #slot facet
     * One row per value of a field, stacked down the track with a label, a
     * separator and the clustering sidebar. `source` — one row per subtrack —
     * is the only field this display reads; leave it unset and every subtrack
     * is drawn in one shared plot. `domain` is the row order: the subtracks it
     * names lead, the rest keep the adapter's order, and a clustering run
     * rotates its dendrogram towards it rather than discarding it.
     */
    facet: facetConfigSchema,
    /**
     * #slot
     */
    minimalTicks: {
      type: 'boolean',
      defaultValue: false,
      description: 'Draw only the min/max Y-axis ticks',
      advanced: true,
    },
    ...treeSidebarConfigSchemaFields({
      tree: 'Show the subtrack clustering tree in the sidebar',
      rowLabels: 'Name each subtrack row down the left edge',
    }),
    ...rowSeparatorsConfigSchemaFields(),
    /**
     * #slot
     */
    showLegend: {
      type: 'boolean',
      description: 'Draw the source color key in overlay mode. Defaults to on',
      defaultValue: true,
    },
  },
  {
    explicitlyTyped: true,
    explicitIdentifier: 'displayId',
    preProcessSnapshot: checkFacetField,
  },
)

export default configSchema

export type MultiLinearWiggleDisplayConfigModel = typeof configSchema
