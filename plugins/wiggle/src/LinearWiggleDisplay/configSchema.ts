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
import { wiggleColorSchema } from '../shared/wiggleColorConfigSchema.ts'
import {
  wiggleConfigSchemaFields,
  wiggleValueScale,
} from '../shared/wiggleConfigSchemaFields.ts'
import { WIGGLE_RENDERING_TYPES } from '../util.ts'

/**
 * #config LinearWiggleDisplay
 * #category display
 * configuration for the quantitative display: an XY plot, density, line or
 * scatter rendering of one source or of many, with `facet: 'source'` giving
 * each source a row of its own
 *
 * Per-source metadata (a `name`, `color` and `group` for each) is preloaded on
 * the *adapter* rather than here — see `MultiWiggleAdapter`'s `subadapters`
 * slot, where `group` drives the sidebar clustering tree and `color` sets each
 * source's line or fill.
 *
 * These are display-level slots: set them inside a track's `displays` to
 * change its defaults (setting them at the track top level has no effect).
 * The object shorthand `displayDefaults: { key: value }` is equivalent to the
 * full `displays: [{ type: 'LinearWiggleDisplay', displayId: '...', key: value }]`
 * array form — see
 * [configuring displays](/docs/config_guides/tracks#configuring-displays).
 *
 * #example
 * Minimal `QuantitativeTrack` config. See the
 * [quantitative track guide](/docs/config_guides/quantitative_track) for all
 * adapter and display options:
 * ```js
 * {
 *   type: 'QuantitativeTrack',
 *   trackId: 'coverage',
 *   name: 'Coverage',
 *   assemblyNames: ['hg38'],
 *   adapter: { type: 'BigWigAdapter', uri: 'https://example.com/coverage.bw' },
 * }
 * ```
 *
 * #example
 * Several bigWigs stacked one per row, which is what a `MultiQuantitativeTrack`
 * does by default:
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
 *   displayDefaults: { facet: 'source' },
 * }
 * ```
 *
 * #example
 * Taller track, log scale, custom color:
 * ```js
 * {
 *   type: 'QuantitativeTrack',
 *   trackId: 'coverage',
 *   name: 'Coverage',
 *   assemblyNames: ['hg38'],
 *   adapter: { type: 'BigWigAdapter', uri: 'https://example.com/coverage.bw' },
 *   displayDefaults: {
 *     height: 200,
 *     scales: { y: { type: 'log' } },
 *     color: 'darkgreen',
 *   },
 * }
 * ```
 */
const linearWiggleDisplayConfigSchema = ConfigurationSchema(
  'LinearWiggleDisplay',
  {
    /**
     * #slot
     * Default rendering type: `xyplot`, `density`, `line`, `linecenter`, or
     * `scatter`.
     * #example
     * ```json
     * {
     *   "type": "LinearWiggleDisplay",
     *   "defaultRendering": "density"
     * }
     * ```
     */
    defaultRendering: {
      type: 'stringEnum',
      model: types.enumeration('Rendering type', [...WIGGLE_RENDERING_TYPES]),
      defaultValue: 'xyplot',
      description: 'Default rendering type',
    },
    /**
     * #slot facet
     * One row per value of a field, stacked down the track with a label, a
     * separator and the clustering sidebar. `source` — one row per subtrack —
     * is the only field this display reads; leave it unset and every source is
     * drawn in one shared plot. `domain` is the row order: the subtracks it
     * names lead, the rest keep the adapter's order, and a clustering run
     * rotates its dendrogram towards it rather than discarding it.
     * #example
     * ```json
     * {
     *   "type": "LinearWiggleDisplay",
     *   "facet": "source"
     * }
     * ```
     */
    facet: facetConfigSchema,
    ...trackHeightConfigSchemaFields(),
    /**
     * #slot color
     * One CSS colour, or a field through a scale — `score` through
     * `threshold` for the bicolor plot, through `linear` or `log` for the
     * density ramp, `source` through `categorical` for a palette entry per
     * subtrack. Unset, the layout decides: several sources in one plot box
     * take a palette entry each, and anything else is the pos/neg pair about
     * the `origin`.
     * #example
     * ```json
     * {
     *   "type": "LinearWiggleDisplay",
     *   "color": { "field": "score", "scale": "threshold", "domain": [2] }
     * }
     * ```
     */
    color: wiggleColorSchema,
    ...wiggleConfigSchemaFields,
    /**
     * #slot scales
     * The y scale the plot is drawn through: `type`, `domainMin`,
     * `domainMax`, `autoscale`, `numStdDev`, `numQuantile`, `symlogConstant`
     * and `rules`, the reference lines drawn across it. The density rendering
     * draws no rule and does not widen to one: it spends colour on the score
     * and has no axis to rule.
     * #example
     * ```json
     * {
     *   "type": "LinearWiggleDisplay",
     *   "scales": { "y": { "rules": [{ "value": 30, "label": "2 copies" }, 15] } }
     * }
     * ```
     */
    scales: wiggleValueScale(),
    /**
     * #slot
     */
    showLegend: {
      type: 'boolean',
      description:
        "Draw the key: density's score color ramp, or the source colors where several share one plot. Defaults to on",
      defaultValue: true,
    },
    /**
     * #slot
     */
    minimalTicks: {
      type: 'boolean',
      defaultValue: false,
      description: 'Draw only the min/max Y-axis ticks',
      advanced: true,
    },
    ...summaryScoreModeConfigSchemaFields({ defaultMode: 'whiskers' }),
    ...treeSidebarConfigSchemaFields({
      tree: 'Show the subtrack clustering tree in the sidebar',
      rowLabels: 'Name each subtrack row down the left edge',
    }),
    ...rowSeparatorsConfigSchemaFields(),
  },
  {
    explicitlyTyped: true,
    explicitIdentifier: 'displayId',
    preProcessSnapshot: checkFacetField('LinearWiggleDisplay'),
  },
)

export default linearWiggleDisplayConfigSchema

export type LinearWiggleDisplayConfigSchema =
  typeof linearWiggleDisplayConfigSchema
