import { ConfigurationSchema } from '@jbrowse/core/configuration'

import {
  ROW_ARRANGEMENT_MEMBERS,
  rowArrangementConfigSchema,
} from './rowArrangementConfigSchema.ts'

/** The `rows` object as read: the field, and the row order. */
export interface RowsSetting {
  field: string
  sort: readonly string[]
}

/**
 * #config Rows
 * #category display
 * The `rows` setting of the displays that draw one row per value of a field,
 * with the dendrogram sidebar beside them: the field, and the arrangement a
 * reader gives the rows. A string is the field; the object adds the order,
 * the labels, the tree with its provenance and the kept rows, each by value
 * of the field.
 *
 * - A settings bag, an agent's plot, a session spec and `displayDefaults`
 *   write `rows` whole, so `rows: "source"` over arranged rows drops the
 *   arrangement. To keep it, write back the object a plot read returned.
 * - A dotted launch modifier, `rows.sort=…`, writes that member alone.
 * - A pick of another field in a menu or the Edit plot form drops the
 *   arrangement, which names the old field's values; the field in force
 *   keeps it.
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
  },
  {
    /**
     * #baseConfiguration
     */
    baseConfiguration: rowArrangementConfigSchema,
    shorthand: 'field',
    writes: 'whole',
    plot: true,
  },
)

/**
 * The rows a pick of `field` writes over `current`: the field in force keeps
 * its arrangement, and another starts with none. The arrangement names the
 * old field's values, so kept it would relabel, hide or draw a tree over the
 * new field's rows wherever the two share a value.
 */
export function rowsForField(
  current: Record<string, unknown>,
  field: string,
): Record<string, unknown> {
  if (field === (current.field ?? '')) {
    return current
  }
  const arrangement = new Set<string>(ROW_ARRANGEMENT_MEMBERS)
  return {
    ...Object.fromEntries(
      Object.entries(current).filter(([key]) => !arrangement.has(key)),
    ),
    field,
  }
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
