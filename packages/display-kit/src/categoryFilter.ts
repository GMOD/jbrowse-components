import { makeRadioSubMenu } from '@jbrowse/core/ui/menuItems'

import type { MenuItem } from '@jbrowse/core/ui'
import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'

/**
 * A category in a filter: `only` its members, `exclude` them, or unset for
 * unfiltered. No third `all` member: the absent filter and the inactive filter
 * are one state, and a stored `all` would be a second spelling of it that
 * every count of active filters would have to know about.
 */
export const CATEGORY_FILTERS = ['only', 'exclude'] as const

export type CategoryFilter = (typeof CATEGORY_FILTERS)[number]

/**
 * A boolean field's entries in a `filter` list as the three-way menu reads
 * them: `only` for `equal: true`, `exclude` for `equal: false`, unset
 * otherwise.
 */
export function categoryOf(
  predicates: readonly FieldPredicate[],
  field: string,
): CategoryFilter | undefined {
  const equal = predicates.find(
    p => p.field === field && typeof p.equal === 'boolean',
  )?.equal
  return equal === true ? 'only' : equal === false ? 'exclude' : undefined
}

/** The entries a category radio writes on `field`: none for unset. */
export function categoryEntries(
  field: string,
  value: CategoryFilter | undefined,
): FieldPredicate[] {
  return value === undefined ? [] : [{ field, equal: value === 'only' }]
}

export interface CategoryFilterLabels {
  noun: string
  all: string
  only: string
  exclude: string
  helpText?: string
}

// One submenu per filter category, three radios inside: every row, only the
// category's, or none of them. The alignments read, junction and connection
// categories and the feature display's genes all take it, so a category
// filter reads and writes the same way wherever it sits.
//
// The row names the category alone, never its current choice: the menu's
// "Filter by (n)" count says a filter is on. Help text, where a caller
// passes it, sits on the row rather than on all three radios.
export function categoryFilterItem(
  { noun, all, only, exclude, helpText }: CategoryFilterLabels,
  value: CategoryFilter | undefined,
  onChange: (value: CategoryFilter | undefined) => void,
  gate?: { disabled: boolean; disabledHelpText: string },
): MenuItem {
  return {
    ...makeRadioSubMenu<CategoryFilter | 'all'>({
      label: noun,
      helpText,
      value: value ?? 'all',
      options: [
        ['all', all],
        ['only', only],
        ['exclude', exclude],
      ],
      onChange: choice => {
        onChange(choice === 'all' ? undefined : choice)
      },
    }),
    ...gate,
  }
}
