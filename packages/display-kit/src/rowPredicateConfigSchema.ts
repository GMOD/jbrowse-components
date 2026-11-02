import { ConfigurationSchema } from '@jbrowse/core/configuration'

import {
  fieldPredicateArray,
  fieldPredicateConfigSchema,
} from './fieldPredicateConfigSchema.ts'

/**
 * The fields that name a row or are drawn off it rather than describe it,
 * which `rows.filter` refuses: a row's name goes in `rows.kept`.
 */
export const ROW_IDENTITY_FIELDS = [
  'name',
  'sampleName',
  'HP',
  'label',
  'color',
]

/** What a write of `rows.filter` on a row's identity is refused with. */
export const ROW_IDENTITY_POINTER =
  "names a row rather than an attribute of one: a row's name goes in rows.kept"

/**
 * #config RowPredicate
 * #category display
 * One entry of `rows.filter`: a [FieldPredicate](../fieldpredicate) over a
 * row attribute, a samplesTsv column on the variant display, a subtrack field
 * on wiggle, `group` on the mark displays. A row's name, its sample, its
 * haplotype, its label and its color are refused, since they name a row
 * rather than describe it: a row's name goes in `rows.kept`. A row missing
 * the attribute (absent or empty) fails every test but `valid: false`, which
 * selects exactly those rows.
 *
 * #example
 * ```js
 * { type: 'LinearVariantDisplay', rows: { filter: [{ field: 'population', oneOf: ['EUR', 'AFR'] }] } }
 * ```
 */
export const rowPredicateConfigSchema = ConfigurationSchema(
  'RowPredicate',
  {},
  {
    baseConfiguration: fieldPredicateConfigSchema,
    refuses: [
      {
        id: 'row-filter-identity',
        when: { field: ROW_IDENTITY_FIELDS },
        slots: ['equal', 'oneOf', 'lt', 'lte', 'gt', 'gte', 'range', 'valid'],
        message: ROW_IDENTITY_POINTER,
      },
    ],
  },
)

/** `rows.filter`'s type: a list of row predicates, ANDed. */
export function rowFilterList() {
  return fieldPredicateArray(rowPredicateConfigSchema)
}
