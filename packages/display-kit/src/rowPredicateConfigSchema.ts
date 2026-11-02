import { ConfigurationSchema, refuseOnWrite } from '@jbrowse/core/configuration'
import { isJexl } from '@jbrowse/core/util/jexlStrings'

import {
  fieldPredicateArray,
  fieldPredicateConfigSchema,
} from './fieldPredicateConfigSchema.ts'

/**
 * The fields that name a row or are drawn off it rather than describe it,
 * which `rows.filter` refuses: a row's name goes in `rows.kept`. `sample` is
 * a samples file's first column, folded into the name; `source` is a
 * subtrack's name.
 */
export const ROW_IDENTITY_FIELDS = [
  'name',
  'sampleName',
  'sample',
  'source',
  'HP',
  'label',
  'color',
  'rowColor',
]

/**
 * What a `rows.filter` entry on a row's identity is refused with, `field`
 * naming it; the schema's refusal names the entry's own field through the
 * `{field}` placeholder.
 */
export function rowIdentityPointer(field: string) {
  return `field '${field}' names a row rather than an attribute of one: a row's name goes in rows.kept, as kept: ['HG002']`
}

/** What a `rows.filter` entry on a `jexl:` expression is refused with. */
export function rowExpressionPointer(field: string) {
  return `field '${field}' is an expression, and rows.filter computes none: it tests a row attribute, such as population`
}

/**
 * #config RowPredicate
 * #category display
 * One entry of `rows.filter`: a [FieldPredicate](../fieldpredicate) over a
 * row attribute, a samplesTsv column on the variant display, a subtrack field
 * on wiggle, `group` on the mark displays. A row's name, its sample, its
 * source, its haplotype, its label and its colors are refused, since they
 * name a row rather than describe it: a row's name goes in `rows.kept`. So is
 * a `jexl:` field, which a row has no record to compute over. A row missing
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
        slots: ['field'],
        message: rowIdentityPointer('{field}'),
      },
    ],
    preProcessSnapshot: snap => {
      const { field } = snap
      if (typeof field === 'string' && isJexl(field)) {
        refuseOnWrite(`rows.filter: ${rowExpressionPointer(field)}`)
        return { field }
      }
      return snap
    },
  },
)

/** `rows.filter`'s type: a list of row predicates, ANDed. */
export function rowFilterList() {
  return fieldPredicateArray(rowPredicateConfigSchema)
}
