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
      'forward/reverse). Works on long reads through the first two. Both ' +
      'ends must be placed: a read at mapping quality 0 carries none, a ' +
      'split read counts only when some other piece of it is above 0, and ' +
      'a discordant read only when its mate is, where the file records the ' +
      'mate in an MQ tag. Each window is judged on its own, so in a ' +
      'multi-region view a mate in another window counts only by what that ' +
      'window holds.',
  },
  {
    key: 'alone',
    noun: 'Reads alone in the window',
    only: 'Only reads alone in the window',
    exclude: 'Hide reads alone in the window',
    helpText:
      'Reads with no other alignment of the same read in the window: no ' +
      'mate and no split or supplementary segment here. That takes in a ' +
      'mate that is unmapped, on another chromosome or outside the window, ' +
      'and a single-end read with no SA tag. Grouped by read name, so it ' +
      'applies to a plain pileup too. "Window", not "view": each displayed ' +
      'region is fetched and grouped on its own, so in a multi-region view ' +
      '(a fusion with one window per partner) a read whose two alignments ' +
      'land in different windows counts as alone in both.',
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
