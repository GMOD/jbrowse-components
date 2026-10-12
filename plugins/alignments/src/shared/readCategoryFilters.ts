import type { CategoryFilter, ReadFilter, ReadCategoryKey } from './types.ts'

export type { ReadCategoryKey }

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
  /** Shown once, on the menu's category row, rather than on each of its radios. */
  helpText: string
}

export const READ_CATEGORIES = [
  {
    key: 'svSignal',
    noun: 'SV evidence',
    only: 'Only SV evidence',
    exclude: 'Hide SV evidence',
    helpText:
      'Reads carrying structural-variant evidence, and the rest of their ' +
      'pair in the same window: a split read (SA tag or supplementary ' +
      'flag), an insertion or deletion of 50 bp or more, or a paired read ' +
      'the aligner did not call concordant (no proper-pair flag 0x2, a mate ' +
      'unmapped or on another chromosome, or a pair not facing ' +
      'forward/reverse). Works on long reads through the first two. Each ' +
      'window is judged on its own, so in a multi-region view a mate in ' +
      'another window counts only by what that window holds. The minimum ' +
      'mapping quality judges each read alone, so a read whose mate was ' +
      'placed at low quality still counts by its flags.',
  },
  {
    key: 'singletons',
    noun: 'Reads without a mate',
    only: 'Only reads without a mate',
    exclude: 'Hide reads without a mate',
    helpText:
      'Reads whose mate and split/supplementary segments are all absent from ' +
      'the same window, so the read stands alone (samtools calls these ' +
      '"singletons"). Grouped by read name, so it applies to a plain pileup ' +
      'too. "Window", not "view": each displayed region is fetched and ' +
      'grouped on its own, so in a multi-region view (a fusion with one ' +
      'window per partner) a read whose two alignments land in different ' +
      'windows counts as alone in both.',
  },
  {
    key: 'split',
    noun: 'Split alignments',
    only: 'Only split alignments',
    exclude: 'Hide split alignments',
    helpText:
      'Reads aligned in pieces — chimeric SV/breakpoint evidence: a read ' +
      'carrying an SA tag, which the aligner writes on every piece, the ' +
      'primary included, or the supplementary flag (0x800). Read off the ' +
      'record rather than off what this window happened to fetch, so unlike ' +
      'the mate filter above it means the same thing at any zoom. Grouped by ' +
      'read name, so it applies to a plain pileup too.',
  },
  {
    key: 'spliced',
    noun: 'Spliced reads',
    only: 'Only spliced reads',
    exclude: 'Hide spliced reads',
    helpText:
      'Reads whose CIGAR carries a reference skip (N) — an intron, in ' +
      'RNA-seq. The one category decided per record as the adapter parses it, ' +
      'rather than over the whole chain a read belongs to.',
  },
] as const satisfies readonly ReadCategorySpec[]

/**
 * What a category's radios are selected by. `'all'` is the UI's name for the
 * absent filter — {@link CategoryFilter} deliberately has no such member, so
 * this is the one place the two spellings meet.
 */
export type ReadCategoryChoice = CategoryFilter | 'all'

export function readCategoryChoice(
  filterBy: ReadFilter,
  key: ReadCategoryKey,
): ReadCategoryChoice {
  return filterBy[key] ?? 'all'
}

export function setReadCategory(
  filterBy: ReadFilter,
  key: ReadCategoryKey,
  choice: ReadCategoryChoice,
): ReadFilter {
  return { ...filterBy, [key]: choice === 'all' ? undefined : choice }
}

/** How many categories are filtering. One each, like every other filter. */
export function activeReadCategoryCount(filterBy: ReadFilter) {
  return READ_CATEGORIES.filter(c => filterBy[c.key] !== undefined).length
}
