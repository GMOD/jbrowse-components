import { makeRadioSubMenu, withHint } from '@jbrowse/core/ui/menuItems'

import type { MenuItem } from '@jbrowse/core/ui'

/**
 * A category in a filter: `only` its members, `exclude` them, or unset for
 * unfiltered. No third `all` member: the absent filter and the inactive filter
 * are one state, and a stored `all` would be a second spelling of it that
 * every count of active filters would have to know about.
 */
export const CATEGORY_FILTERS = ['only', 'exclude'] as const

export type CategoryFilter = (typeof CATEGORY_FILTERS)[number]

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
// The choice shows on the parent row (`withHint`), so which categories are
// filtering is readable without opening any of them, and the help text sits
// there too rather than on all three radios saying much the same thing.
export function categoryFilterItem(
  { noun, all, only, exclude, helpText }: CategoryFilterLabels,
  value: CategoryFilter | undefined,
  onChange: (value: CategoryFilter | undefined) => void,
  gate?: { disabled: boolean; disabledHelpText: string },
): MenuItem {
  return {
    ...makeRadioSubMenu<CategoryFilter | 'all'>({
      // 'hidden' rather than the stored 'exclude': the row is reporting what
      // the user sees, and the vocabulary is the wire format's, not theirs.
      label: withHint(
        noun,
        value === undefined ? undefined : value === 'only' ? 'only' : 'hidden',
      ),
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
