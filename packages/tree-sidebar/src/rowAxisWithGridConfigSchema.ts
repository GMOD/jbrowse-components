import { ConfigurationSchema } from '@jbrowse/core/configuration'

import { rowAxisConfigSchema } from './rowAxisConfigSchema.ts'

/**
 * #config RowAxisWithGrid
 * #category display
 * A [RowAxis](../rowaxis) with `grid`, Vega-Lite's word for the lines an axis
 * carries across the plot: here a hairline between adjacent rows.
 *
 * #example
 * ```js
 * { type: 'LinearWiggleDisplay', axis: { grid: true, labels: false } }
 * ```
 */
export const rowAxisWithGridConfigSchema = ConfigurationSchema(
  'RowAxisWithGrid',
  {
    /**
     * #slot
     * Off by default: rows that differ in color already show a boundary.
     * Drawn only once rows are at least 4px tall, below which the line is as
     * thick as the row.
     */
    grid: {
      type: 'boolean',
      defaultValue: false,
      description:
        'draw a hairline between adjacent rows, once rows are at least 4px tall',
    },
  },
  {
    /**
     * #baseConfiguration
     */
    baseConfiguration: rowAxisConfigSchema,
  },
)
