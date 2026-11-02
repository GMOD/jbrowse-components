import { ConfigurationSchema, keyedBase } from '@jbrowse/core/configuration'

import {
  ROW_ARRANGEMENT_MEMBERS,
  rowArrangementConfigSchema,
} from './rowArrangementConfigSchema.ts'
import { rowAxisWithGridConfigSchema } from './rowAxisWithGridConfigSchema.ts'
import { rowColorConfigSchema } from './rowColorConfigSchema.ts'

/** The `rows` object as read: the field, and the row order. */
export interface RowsSetting {
  field: string
  sort: readonly string[]
}

/**
 * The members of `rows` naming a row by its value of `field`: the
 * arrangement, and the colors pinned on rows.
 */
export const ROWS_KEYED_MEMBERS = [
  ...ROW_ARRANGEMENT_MEMBERS,
  'colors',
] as const

/** How `rows` is written: its keyed members name the values of `field`. */
export const ROWS_WRITES = {
  keyedBy: 'field',
  keyed: ROWS_KEYED_MEMBERS,
} as const

/**
 * #config Rows
 * #category display
 * The `rows` setting of the displays that draw one row per value of a field,
 * with the dendrogram sidebar beside them: the field, and the arrangement a
 * reader gives the rows. A string is the field; the object adds the order,
 * the labels, the colors, the tree with its provenance and the kept rows,
 * each by value of the field, and `color`, the rows colored by an attribute.
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
    /**
     * #slot colors
     * A color pinned on a row, by name, over whatever `rows.color` maps it
     * to, as `labels` pins its text: ggplot2's
     * `scale_*_manual(values = c(name = ...))`. The arrangement dialog's row
     * swatches write it. A row with none takes `rows.color`, else the file's
     * own color (MAF's `samples[].color`, a listed source's color), else the
     * palette where the rows share one panel.
     */
    colors: {
      type: 'stringMap',
      defaultValue: {},
      description:
        "a color pinned on a row, by name, over the color rows.color maps it to; a row with none takes rows.color, else the file's own color",
    },
    /**
     * #slot color
     * The rows colored by an attribute: a [RowColor](../rowcolor) channel
     * from a row field through a scale, `name` (each row) by default. Per-row
     * colors are `rows.colors`, which win over it.
     */
    color: rowColorConfigSchema,
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
