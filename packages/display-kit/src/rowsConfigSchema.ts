import { ConfigurationSchema } from '@jbrowse/core/configuration'

import { rowArrangementConfigSchema } from './rowArrangementConfigSchema.ts'

/** The `rows` object as read: the field, and the row order. */
export interface RowsSetting {
  field: string
  domain: readonly string[]
}

/**
 * #config Rows
 * #category display
 * The `rows` setting of the displays that draw one row per value of a field,
 * with the dendrogram sidebar beside them: the field, and the arrangement a
 * reader gives the rows. A string is the field; the object adds the order,
 * the labels, the tree with its provenance and the focus, each by value.
 *
 * #example
 * ```js
 * { type: 'LinearWiggleDisplay', rows: 'source' }
 * ```
 * ```js
 * {
 *   type: 'LinearWiggleDisplay',
 *   rows: { field: 'source', domain: ['tumor', 'normal'], labels: { tumor: 'Tumor' } },
 * }
 * ```
 */
export const rowsConfigSchema = ConfigurationSchema(
  'Rows',
  {
    /**
     * #slot field
     * The field each value of which takes a row of its own. Writing
     * `rows: "source"` lands here; empty draws no rows.
     */
    field: {
      type: 'featureField',
      defaultValue: '',
      description: 'the field each value of which takes a row of its own',
    },
  },
  {
    /**
     * #baseConfiguration
     */
    baseConfiguration: rowArrangementConfigSchema,
    shorthand: 'field',
  },
)

/** The rows as read back: undefined while nothing is on rows. */
export function rowsSettingOf(snapshot: {
  field: string
  domain: readonly string[]
}): RowsSetting | undefined {
  return snapshot.field
    ? { field: snapshot.field, domain: snapshot.domain }
    : undefined
}
