import { ConfigurationSchema, plotList } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import type { Instance } from '@jbrowse/mobx-state-tree'

const Scalar = types.union(types.string, types.number, types.boolean)

/**
 * #config FieldPredicate
 * #category display
 * One entry of a `filter` list, Vega-Lite's field predicate: the `field` of
 * each record and the tests its value must pass, every one given. A `filter`
 * list admits a record that passes every entry. A comparison on a missing
 * value is false, and `valid: false` selects the missing values.
 *
 * A `field` written `jexl:` is computed per feature, where the display reads
 * jexl, and a bare string entry is one that must hold:
 * `"jexl:feature.score > 100"` is `{ field: "jexl:feature.score > 100",
 * equal: true }`.
 *
 * #example
 * ```js
 * filter: [{ field: 'length', gte: 10000 }, { field: 'identity', gte: 0.9 }]
 * ```
 * ```js
 * filter: [{ field: 'query', oneOf: ['chr1', 'chr2'] }]
 * ```
 * ```js
 * filter: [{ field: 'gene_group', valid: true }]
 * ```
 * ```js
 * filter: ['jexl:feature.end - feature.start > 1000']
 * ```
 */
export const fieldPredicateConfigSchema = ConfigurationSchema(
  'FieldPredicate',
  {
    /**
     * #slot
     */
    field: {
      type: 'featureField',
      defaultValue: '',
      description:
        'the field tested, as the display names its fields, or a jexl: expression computed per feature',
    },
    /**
     * #slot
     */
    equal: {
      type: 'maybeFrozen',
      model: types.maybe(Scalar),
      description: 'the value must equal this',
    },
    /**
     * #slot
     */
    lt: { type: 'maybeNumber', description: 'the value must be below this' },
    /**
     * #slot
     */
    lte: { type: 'maybeNumber', description: 'the value must be at most this' },
    /**
     * #slot
     */
    gt: { type: 'maybeNumber', description: 'the value must be above this' },
    /**
     * #slot
     */
    gte: {
      type: 'maybeNumber',
      description: 'the value must be at least this',
    },
    /**
     * #slot
     */
    oneOf: {
      type: 'maybeFrozen',
      model: types.maybe(types.array(Scalar)),
      description: 'the value must be one of these',
    },
    /**
     * #slot
     */
    valid: {
      type: 'maybeBoolean',
      description:
        'true admits only records with a value for the field, false only those without',
    },
  },
  {
    closed: true,
    shorthand: 'field',
    shorthandWith: { equal: true },
    writes: 'whole',
  },
)

export interface FieldPredicateConfig extends Instance<
  typeof fieldPredicateConfigSchema
> {}

/** A display's `filter` slot: a list of predicates, edited by "Edit plot...". */
export function fieldPredicateList() {
  return plotList(types.array(fieldPredicateConfigSchema))
}
