import { ConfigurationSchema } from '@jbrowse/core/configuration'

import { markRowsConfigSchema } from '../LinearMarkDisplay/markRowsConfigSchema.ts'

/** The field the multi-row display rows on where its config names none. */
export const DEFAULT_ROWS_FIELD = 'type'

/**
 * #config MultiRowRows
 * #category display
 * The multi-row display's `rows`: a [MarkRows](../markrows) whose `field`
 * declares `type` as its default, so a track with nothing written draws a row
 * per kind of feature. A field written overrides it, as the shorthand string
 * or the object, and `''` written is one row. The shared
 * [Rows](../rows) keeps `''`, no rows, for every other display. A write
 * changing the field in force, the default included, drops the arrangement
 * members naming its rows (ADR-257).
 *
 * #example
 * ```js
 * { type: 'LinearMultiRowFeatureDisplay', rows: 'sample' }
 * ```
 * ```js
 * { type: 'LinearMultiRowFeatureDisplay', rows: { field: 'sample', sort: ['mom', 'dad'] } }
 * ```
 * ```js
 * { type: 'LinearMultiRowFeatureDisplay', rows: '' }
 * ```
 */
export const multiRowRowsConfigSchema = ConfigurationSchema(
  'MultiRowRows',
  {
    /**
     * #slot field
     * The field whose values each take a row: `type` unless written, `''`
     * for one row.
     */
    field: {
      type: 'featureField',
      defaultValue: DEFAULT_ROWS_FIELD,
      description: 'the field whose values each take a row',
    },
  },
  {
    /**
     * #baseConfiguration
     */
    baseConfiguration: markRowsConfigSchema,
  },
)
