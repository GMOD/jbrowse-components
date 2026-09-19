import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { facetConfigSchema } from '@jbrowse/display-kit/facetConfigSchema'
import { trackHeightConfigSchemaFields } from '@jbrowse/display-kit/trackHeightConfigSchemaFields'
import { types } from '@jbrowse/mobx-state-tree'

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
 * configuration for the wiggle (quantitative/numeric) display showing XY plot, density, line, or scatter renderings
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
// What `facet` cannot mean here, refused where the config is read rather than
// where the rows are laid out. `source` is the one field a quantitative row can
// be: a wiggle carries a score per base and a subtrack name, and nothing else
// to section on. `group` — one section per adapter group, its subtracks
// overlaid inside — is the next value, which is why this is a facet and not a
// boolean.
function checkFacetField(snap: Record<string, unknown>) {
  const facet = snap.facet as string | { field?: unknown } | undefined
  const declared = typeof facet === 'string' ? facet : facet?.field
  const field = typeof declared === 'string' ? declared : ''
  if (field && field !== 'source') {
    throw new Error(
      `LinearWiggleDisplay: facet.field is "${field}", and this display sections on "source" alone — one row per subtrack`,
    )
  }
  return snap
}

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
      description: 'Draw the score color ramp in density mode. Defaults to on',
      defaultValue: true,
    },
    /**
     * #slot
     * Not in the shared wiggle fields: `MultiLinearWiggleDisplay` spreads those
     * and stacks a plot box per row, so one rule list has no single axis to sit
     * on there.
     */
    scoreRules: {
      type: 'frozen',
      defaultValue: [],
      description:
        'Horizontal reference lines across the plot, as [{"value": 30, "label": "2 copies"}] — or bare numbers for unlabelled rules. Labels are free text that JBrowse assigns no meaning; see the wiggle-core `ScoreRule` docs for why. Ignored by the density rendering types, which spend color rather than height on the score and so have no axis to rule',
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
  },
  {
    explicitlyTyped: true,
    explicitIdentifier: 'displayId',
    preProcessSnapshot: (snap: Record<string, unknown>) =>
      colorImpliesSolid(checkFacetField(snap)),
  },
)

export default linearWiggleDisplayConfigSchema

export type LinearWiggleDisplayConfigSchema =
  typeof linearWiggleDisplayConfigSchema
