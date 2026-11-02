import { ConfigurationSchema, keyedBase } from '@jbrowse/core/configuration'

import {
  ROW_ARRANGEMENT_MEMBERS,
  rowArrangementConfigSchema,
} from './rowArrangementConfigSchema.ts'
import { rowAxisWithGridConfigSchema } from './rowAxisWithGridConfigSchema.ts'

/** The `rows` object as read: the field, and the row order. */
export interface RowsSetting {
  field: string
  sort: readonly string[]
}

/** How `rows` is written: its arrangement names the values of `field`. */
export const ROWS_WRITES = {
  keyedBy: 'field',
  keyed: ROW_ARRANGEMENT_MEMBERS,
} as const

/**
 * #config Rows
 * #category display
 * The `rows` setting of the displays that draw one row per value of a field,
 * with the dendrogram sidebar beside them: the field, and the arrangement a
 * reader gives the rows. A string is the field; the object adds the order,
 * the labels, the tree with its provenance and the kept rows, each by value
 * of the field.
 *
 * #example
 * ```js
 * { type: 'LinearWiggleDisplay', rows: 'source' }
 * ```
 * ```js
 * { type: 'LinearMultiRowFeatureDisplay', rows: 'sample' }
 * ```
 * ```js
 * {
 *   type: 'LinearWiggleDisplay',
 *   rows: { field: 'source', sort: ['tumor', 'normal'], labels: { tumor: 'Tumor' } },
 * }
 * ```
 */
export const rowsConfigSchema = ConfigurationSchema(
  'Rows',
  {
    /**
     * #slot field
     * The field whose values each take a row. Writing
     * `rows: "source"` sets this slot. Empty is the display's default: no rows on
     * the quantitative display, and a field picked off the data on the
     * multi-row feature display.
     */
    field: {
      type: 'featureField',
      defaultValue: '',
      description: 'the field whose values each take a row',
    },
    /**
     * #slot axis
     * The guide down the left of the rows, a
     * [RowAxisWithGrid](../rowaxiswithgrid): whether the tree and the row
     * names draw, the sidebar's width, and a line between rows. What it draws
     * is `rows.tree` and `rows.labels`.
     */
    axis: rowAxisWithGridConfigSchema,
  },
  {
    /**
     * #baseConfiguration
     */
    baseConfiguration: rowArrangementConfigSchema,
    shorthand: 'field',
    writes: ROWS_WRITES,
    plot: true,
  },
)

/**
 * The rows a pick of `field` writes over `current`, by the keyed rule
 * (ADR-257): the field in force keeps its arrangement, and another drops it,
 * since kept it would relabel, hide or draw a tree over the new field's rows
 * wherever the two share a value. A pick over no field keeps it.
 */
export function rowsForField(
  current: Record<string, unknown>,
  field: string,
): Record<string, unknown> {
  return field === (current.field ?? '')
    ? current
    : { ...keyedBase(ROWS_WRITES, current, { field }), field }
}

/** The rows as read back: undefined while nothing is on rows. */
export function rowsSettingOf(snapshot: {
  field: string
  sort: readonly string[]
}): RowsSetting | undefined {
  return snapshot.field
    ? { field: snapshot.field, sort: snapshot.sort }
    : undefined
}
