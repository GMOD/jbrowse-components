import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { rowsWithStepConfigSchema } from '@jbrowse/display-kit/rowsWithStepConfigSchema'
import { types } from '@jbrowse/mobx-state-tree'
import { rowGroupConfigSchema } from '@jbrowse/tree-sidebar/rowGroupConfigSchema'

/**
 * #config MarkRows
 * #category display
 * The mark displays' `rows`: a [RowsWithStep](../rowswithstep), the field,
 * arrangement, axis and row height, and `groups`, the `group` row attribute
 * a `facet` bands the rows by and `rows.color` colors them by.
 *
 * #example
 * ```js
 * {
 *   type: 'LinearMultiRowFeatureDisplay',
 *   rows: {
 *     field: 'sample',
 *     groups: [
 *       { match: '^CLUP', group: 'Wolf' },
 *       { match: '^CLAT', group: 'Coyote' },
 *     ],
 *   },
 *   facet: 'group',
 * }
 * ```
 */
export const markRowsConfigSchema = ConfigurationSchema(
  'MarkRows',
  {
    /**
     * #slot groups
     * A list of [RowGroup](../rowgroup) `{ match, group }` entries tagging
     * each row with the `group` of the first entry whose regex its name
     * matches, ggplot2's `group`: `facet: 'group'` stacks the groups in
     * bands, and `rows.color: 'group'` colors them. A row no entry matches
     * has no group. Unlike `sort` or `labels`, it names no row by its value,
     * so a write changing `field` keeps it.
     */
    groups: types.array(rowGroupConfigSchema),
  },
  {
    /**
     * #baseConfiguration
     */
    baseConfiguration: rowsWithStepConfigSchema,
  },
)
