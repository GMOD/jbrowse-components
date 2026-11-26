import { ConfigurationSchema } from '@jbrowse/core/configuration'

import { legendConfigSchema } from './legendConfigSchema.ts'

/**
 * #config FigureLegend
 * #category display
 * The `legend` of a display whose key is off on screen until asked for but
 * drawn in an SVG export, a matrix's color ramp: a heatmap figure needs its
 * scale where a browsing reader does not.
 *
 * #example
 * ```js
 * { type: 'LinearHicDisplay', legend: { show: false } }
 * ```
 */
export const figureLegendConfigSchema = ConfigurationSchema(
  'FigureLegend',
  {
    /**
     * #slot
     */
    show: {
      type: 'maybeBoolean',
      defaultValue: undefined,
      description:
        'draw the key; unset draws it in an SVG export and not on screen',
    },
  },
  {
    /**
     * #baseConfiguration
     */
    baseConfiguration: legendConfigSchema,
  },
)
