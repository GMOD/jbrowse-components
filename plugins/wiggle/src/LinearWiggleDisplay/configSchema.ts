import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { regionTooLargeConfigSchemaFields } from '@jbrowse/display-kit/regionTooLargeConfigSchemaFields'
import { types } from '@jbrowse/mobx-state-tree'

import { colorImpliesSolid } from '../shared/colorImpliesSolid.ts'
import { remapRetiredAutoscale } from '../shared/remapRetiredAutoscale.ts'
import { summaryScoreModeConfigSchemaFields } from '../shared/summaryScoreModeConfigSchemaFields.ts'
import { wiggleConfigSchemaFields } from '../shared/wiggleConfigSchemaFields.ts'
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
 *     scaleType: 'log',
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
     * #slot
     */
    height: {
      type: 'number',
      defaultValue: 100,
      description: 'Default height of the track',
    },
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
    // Owed to `RegionTooLargeMixin`, which this display composes through
    // `MultiRegionDisplayMixin` and which reads both slots through a host cast.
    // This schema does not extend `baseLinearDisplayConfigSchema` (its
    // `mouseover` / `jexlFilters` / `maxFeatureScreenDensity` are all about
    // features, which a quantitative display has none of), so the pair comes
    // from the mixin's own table instead.
    ...regionTooLargeConfigSchemaFields,
  },
  {
    explicitlyTyped: true,
    explicitIdentifier: 'displayId',
    // Map retired global/globalsd autoscale onto local/localsd so old configs
    // don't trip the narrowed enum, and read a bare `color` as solid-color
    // shorthand.
    preProcessSnapshot: (snap: Record<string, unknown>) =>
      colorImpliesSolid(remapRetiredAutoscale(snap)),
  },
)

export default linearWiggleDisplayConfigSchema

export type LinearWiggleDisplayConfigSchema =
  typeof linearWiggleDisplayConfigSchema
