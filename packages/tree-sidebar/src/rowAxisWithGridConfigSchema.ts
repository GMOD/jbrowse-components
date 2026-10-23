import { ConfigurationSchema } from '@jbrowse/core/configuration'

import {
  retiredRowAxisSpellings,
  rowAxisConfigSchema,
} from './rowAxisConfigSchema.ts'

import type { RetiredSpelling } from '@jbrowse/core/configuration'

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

export const retiredRowAxisWithGridSpellings: Record<string, RetiredSpelling> =
  {
    ...retiredRowAxisSpellings,
    showRowSeparators: grid => ({ axis: { grid } }),
  }
