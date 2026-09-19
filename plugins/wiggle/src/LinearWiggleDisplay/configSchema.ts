import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { facetConfigSchema } from '@jbrowse/display-kit/facetConfigSchema'
import { trackHeightConfigSchemaFields } from '@jbrowse/display-kit/trackHeightConfigSchemaFields'
import { types } from '@jbrowse/mobx-state-tree'
import {
  rowSeparatorsConfigSchemaFields,
  treeSidebarConfigSchemaFields,
} from '@jbrowse/tree-sidebar/treeSidebarConfigSchemaFields'

import { checkFacetField } from '../shared/checkFacetField.ts'
import { colorImpliesSolid } from '../shared/colorImpliesSolid.ts'
import { summaryScoreModeConfigSchemaFields } from '../shared/summaryScoreModeConfigSchemaFields.ts'
import {
  wiggleConfigSchemaFields,
  wiggleValueScale,
} from '../shared/wiggleConfigSchemaFields.ts'
import { WIGGLE_POS_COLOR_DEFAULT, WIGGLE_RENDERING_TYPES } from '../util.ts'

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
     * #slot
     */
    useBicolor: {
      type: 'boolean',
      defaultValue: true,
      description:
        'When true (the default), positive scores use posColor and negative use negColor; when false, all bars use the single color slot. Setting color alone, with no posColor/negColor/useBicolor, turns this off for you.',
    },
    /**
     * #slot
     */
    color: {
      type: 'color',
      defaultValue: WIGGLE_POS_COLOR_DEFAULT,
      description:
        'Single fill CSS color for the wiggle bars; a wiggle colors per signal, not per feature, so jexl callbacks do not apply. Set alone it implies useBicolor false; alongside posColor/negColor it goes unused. Density rendering always draws from posColor.',
    },
    ...wiggleConfigSchemaFields,
    /**
     * #slot scales
     * The y scale the plot is drawn through: `type`, `domainMin`,
     * `domainMax`, `autoscale`, `numStdDev`, `numQuantile` and
     * `symlogConstant`.
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
    scoreRules: {
      type: 'frozen',
      defaultValue: [],
      description:
        'Horizontal reference lines across the plot, as [{"value": 30, "label": "2 copies"}] — or bare numbers for unlabelled rules. Labels are free text that JBrowse assigns no meaning; see the wiggle-core `ScoreRule` docs for why. Ignored by the density rendering, which spends color rather than height on the score and so has no axis to rule, and by a faceted track, which stacks a plot box per row',
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
    preProcessSnapshot: (snap: Record<string, unknown>) =>
      colorImpliesSolid(checkFacetField('LinearWiggleDisplay')(snap)),
  },
)

export default linearWiggleDisplayConfigSchema

export type LinearWiggleDisplayConfigSchema =
  typeof linearWiggleDisplayConfigSchema
