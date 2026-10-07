import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config RowGroup
 * #category display
 * One entry of the multi-row feature display's `rowGroups`: a row joins the
 * `group` of the first entry whose `match` regex its name matches, and
 * `rowColor: { field: 'group' }` colours the groups.
 *
 * #example
 * ```js
 * {
 *   type: 'LinearMultiRowFeatureDisplay',
 *   rowGroups: [
 *     { match: '^CLUP', group: 'Wolf' },
 *     { match: '^CLAT', group: 'Coyote' },
 *   ],
 * }
 * ```
 */
export const rowGroupConfigSchema = ConfigurationSchema(
  'RowGroup',
  {
    /**
     * #slot
     */
    match: {
      type: 'string',
      defaultValue: '',
      description:
        'a regex a row name has to match; one that does not compile matches nothing',
    },
    /**
     * #slot
     */
    group: {
      type: 'string',
      defaultValue: '',
      description: 'the group a matching row joins',
    },
  },
  { closed: true },
)
