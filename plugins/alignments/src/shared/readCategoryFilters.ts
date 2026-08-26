import type { CategoryFilter, FilterBy } from './types.ts'

/**
 * The read-category filters, declared once.
 *
 * Four questions of one kind — which reads do I want — that used to be answered
 * three different ways: `spliced` was a three-way radio in the filter dialog,
 * while proper pairs and singletons were "draw" booleans and split alignments a
 * "show only" boolean, all three sitting in the "Show..." menu among the
 * rendering-layer toggles. They filter: every one of them drops reads in the
 * worker before layout and thins the coverage histogram with them, and none was
 * counted by the "Filter by... (n)" badge that `filterMenuItems` documents as
 * the only affordance saying a track is hiding rows.
 *
 * One table so the dialog grid and the track menu cannot word the same filter
 * two ways — `check-menu-labels` gates the docs against these strings — and so
 * that a fifth category is a row here rather than an edit in four files.
 *
 * Folding them into `filterBy` also gave each its missing third state for free:
 * the booleans could hide proper pairs but not ask for only them, and could
 * isolate split reads but not exclude them.
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

export type ReadCategoryKey = 'properPairs' | 'singletons' | 'split' | 'spliced'

export const READ_CATEGORIES = [
  {
    key: 'properPairs',
    noun: 'Proper pairs',
    only: 'Only proper pairs',
    exclude: 'Hide proper pairs',
    helpText:
      'Concordant pairs — those the aligner flagged properly paired (SAM ' +
      'flag 0x2) AND in normal forward/reverse (FR) orientation. Discordant ' +
      'pairs (RR/LL/RL orientation, e.g. inversions or duplications) do not ' +
      'count as proper even when the flag is set, so hiding proper pairs ' +
      'leaves the structural-variant signal on screen.',
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
      'Reads the aligner gave a supplementary segment (SAM flag 0x800) — ' +
      'chimeric SV/breakpoint evidence. Read off the SA tag rather than off ' +
      'what this window happened to fetch, so unlike the mate filter above it ' +
      'means the same thing at any zoom. Grouped by read name, so it applies ' +
      'to a plain pileup too.',
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
  filterBy: FilterBy,
  key: ReadCategoryKey,
): ReadCategoryChoice {
  return filterBy[key] ?? 'all'
}

export function setReadCategory(
  filterBy: FilterBy,
  key: ReadCategoryKey,
  choice: ReadCategoryChoice,
): FilterBy {
  return { ...filterBy, [key]: choice === 'all' ? undefined : choice }
}

/** How many categories are filtering. One each, like every other filter. */
export function activeReadCategoryCount(filterBy: FilterBy) {
  return READ_CATEGORIES.filter(c => filterBy[c.key] !== undefined).length
}
