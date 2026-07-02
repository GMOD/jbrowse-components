import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { remapRetiredAutoscale } from '../shared/remapRetiredAutoscale.ts'
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
 *   displayDefaults: { height: 200, scaleType: 'log', color: 'darkgreen' },
 * }
 * ```
 */
const linearWiggleDisplayConfigSchema = ConfigurationSchema(
  'LinearWiggleDisplay',
  {
    /**
     * #slot
     * Default rendering type: `xyplot`, `density`, `line`, or `scatter`.
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
        'Use separate positive/negative colors instead of a single color',
    },
    /**
     * #slot
     */
    color: {
      type: 'color',
      defaultValue: WIGGLE_POS_COLOR_DEFAULT,
      description: 'Color for the wiggle bars (when not using bicolor mode)',
    },
    ...wiggleConfigSchemaFields,
    /**
     * #slot
     */
    minimalTicks: {
      type: 'boolean',
      defaultValue: false,
      description: 'Draw only the min/max Y-axis ticks',
      advanced: true,
    },
    /**
     * #slot
     */
    summaryScoreMode: {
      type: 'stringEnum',
      model: types.enumeration('Score type', ['max', 'min', 'avg', 'whiskers']),
      description:
        'choose whether to use max/min/average or whiskers which combines all three into the same rendering',
      defaultValue: 'whiskers',
    },
  },
  {
    explicitlyTyped: true,
    explicitIdentifier: 'displayId',
    // Map retired global/globalsd autoscale onto local/localsd so old configs
    // don't trip the narrowed enum.
    preProcessSnapshot: (snap: Record<string, unknown>) =>
      remapRetiredAutoscale(snap),
  },
)

export default linearWiggleDisplayConfigSchema
