import { lowerBoundOf, withLowerBound } from '@jbrowse/core/util/fieldPredicate'
import { fieldPredicateConfigSchema } from '@jbrowse/display-kit/fieldPredicateConfigSchema'
import { cast, getSnapshot, types } from '@jbrowse/mobx-state-tree'

import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'

/**
 * #stateModel SyntenyFilterMixin
 *
 * The `filter` every view drawing synteny tracks applies to the alignments:
 * the linear synteny view's ribbons, the dotplot's segments and the circular
 * view's ribbons.
 */
export function SyntenyFilterMixin() {
  return types
    .model('SyntenyFilterMixin', {
      /**
       * #property
       * The alignments drawn, a list of [](/docs/config/fieldpredicate)
       * entries an alignment must all pass. A field is any field `color`
       * takes, or `length`, the alignment's bp on its own axis:
       * `[{ field: 'length', gte: 10000 }]` clears a whole-genome hairball.
       * A filter edit recolors and refetches nothing.
       */
      filter: types.stripDefault(types.array(fieldPredicateConfigSchema), []),
    })
    .views(self => ({
      /**
       * #getter
       * The `filter` list as the predicate compiler reads it.
       */
      get predicates(): FieldPredicate[] {
        return getSnapshot(self.filter) as FieldPredicate[]
      },
      /**
       * #getter
       * The lower bound on `length`, 0 for none.
       */
      get minLength(): number {
        return lowerBoundOf(this.predicates, 'length') ?? 0
      },
      /**
       * #method
       * The lower bound the filter puts on `field`, 0 for none.
       */
      lowerBound(field: string): number {
        return lowerBoundOf(this.predicates, field) ?? 0
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setFilter(predicates: FieldPredicate[]) {
        self.filter = cast(predicates)
      },
      /**
       * #action
       * The slider on one field: `field` at least `value`, or no lower bound
       * at 0.
       */
      setLowerBound(field: string, value: number) {
        self.filter = cast(
          withLowerBound(self.predicates, field, value > 0 ? value : undefined),
        )
      },
    }))
}
