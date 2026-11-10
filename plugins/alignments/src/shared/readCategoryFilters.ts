import type { CategoryFilter, ReadCategoryKey } from './types.ts'

export type { ReadCategoryKey }

/** Whether a row in or out of a category passes that category's filter. */
export function passesCategory(
  inCategory: boolean,
  filter: CategoryFilter | undefined,
) {
  return filter === undefined || inCategory === (filter === 'only')
}

/**
 * The read-category filters, declared once, so the dialog grid and the track
 * menu cannot word the same filter two ways (`check-menu-labels` gates the docs
 * against these strings) and a new category is a row here.
 */
export interface ReadCategorySpec {
  key: ReadCategoryKey
  /** Row label in the dialog grid, and the submenu row in the track menu. */
  noun: string
  /** Option labels. The absent state is 'All reads' for every category. */
  only: string
  exclude: string
}

export const READ_CATEGORIES = [
  {
    key: 'svSignal',
    noun: 'SV evidence',
    only: 'Only SV evidence',
    exclude: 'Hide SV evidence',
  },
  {
    key: 'alone',
    noun: 'Reads with no mate in view',
    only: 'Only reads with no mate in view',
    exclude: 'Hide reads with no mate in view',
  },
  {
    key: 'split',
    noun: 'Split reads',
    only: 'Only split reads',
    exclude: 'Hide split reads',
  },
  {
    key: 'spliced',
    noun: 'Spliced reads',
    only: 'Only spliced reads',
    exclude: 'Hide spliced reads',
  },
] as const satisfies readonly ReadCategorySpec[]
