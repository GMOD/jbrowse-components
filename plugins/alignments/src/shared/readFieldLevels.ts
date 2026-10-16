import { MAPQ_BINS } from '@jbrowse/core/util/colorScale'

import type { PairDirection } from '@jbrowse/alignments-core'

/**
 * The values a categorical read field takes, in its own order, shared by
 * every channel naming the field: a `facet` section is keyed by one and a
 * `color.domain` names one, so `{ field: 'pairOrientation', domain: ['RR'] }`
 * means the same thing under both. A domain lists its values first and the
 * rest follow this order. Strand's values are core's universal `strand`
 * vocabulary.
 */
export const PAIR_ORIENTATION_LEVELS = [
  'LR',
  'RL',
  'RR',
  'LL',
] as const satisfies readonly PairDirection[]

export const INSERT_SIZE_LEVELS = ['short', 'normal', 'long'] as const

/** SAM's "mapping quality unavailable", a level of its own on every channel. */
export const MAPQ_UNAVAILABLE_LEVEL = '255'

export const SPLIT_LEVELS = ['split', 'unsplit'] as const

export const SPLICED_LEVELS = ['spliced', 'unspliced'] as const

/**
 * Where a read stands in its pair. `concordant` is the aligner's verdict
 * (`isConcordantPairRead`), so a file whose aligner never sets the proper-pair
 * flag files every pair `discordant`. `nonPrimary` is a secondary or
 * supplementary record, whose own flags and orientation do not describe its
 * pair.
 */
export const PAIRING_LEVELS = [
  'concordant',
  'discordant',
  'unpaired',
  'nonPrimary',
] as const

export type Pairing = (typeof PAIRING_LEVELS)[number]

/**
 * A read's strongest SV evidence, by the tier `svSignalTier` stores: a split
 * read, an indel of 50 bp or more, a discordant pair, or none.
 */
export const SV_SIGNAL_LEVELS = [
  'split',
  'svIndel',
  'discordant',
  'none',
] as const

export type SvSignal = (typeof SV_SIGNAL_LEVELS)[number]

/** The level `svSignalTier`'s tier names, 0 for none. */
export const SV_SIGNAL_OF_TIER: readonly SvSignal[] = [
  'none',
  'discordant',
  'svIndel',
  'split',
]

/**
 * The color fields the main thread answers per read from arrays every fetch
 * ships, so picking one recolors what is loaded instead of refetching it.
 * Each is a facet dimension too, and a read takes the level its section is
 * keyed by.
 */
export const READ_LEVEL_SCHEMES = [
  'split',
  'spliced',
  'pairing',
  'svSignal',
] as const

export type ReadLevelScheme = (typeof READ_LEVEL_SCHEMES)[number]

/**
 * The level a read takes when it has nothing to show: it keeps the plain
 * fill, as a read with no tag value does.
 */
export const BASELINE_LEVEL = {
  split: 'unsplit',
  spliced: 'unspliced',
  pairing: 'concordant',
  svSignal: 'none',
} as const satisfies Record<ReadLevelScheme, string>

export function isReadLevelScheme(type: string): type is ReadLevelScheme {
  return (READ_LEVEL_SCHEMES as readonly string[]).includes(type)
}

type Labelled<L extends readonly string[]> = Readonly<Record<L[number], string>>

/** Each level's name, as a facet section and a color key both print it. */
export const READ_LEVEL_LABELS: {
  split: Labelled<typeof SPLIT_LEVELS>
  spliced: Labelled<typeof SPLICED_LEVELS>
  pairing: Labelled<typeof PAIRING_LEVELS>
  svSignal: Labelled<typeof SV_SIGNAL_LEVELS>
} = {
  split: { split: 'Split (SA)', unsplit: 'Not split' },
  spliced: { spliced: 'Spliced', unspliced: 'Not spliced' },
  pairing: {
    concordant: 'Concordant',
    discordant: 'Discordant',
    unpaired: 'Unpaired',
    nonPrimary: 'Secondary or supplementary',
  },
  svSignal: {
    split: 'Split read',
    svIndel: 'SV-size indel',
    discordant: 'Discordant pair',
    none: 'No SV evidence',
  },
}

const LEVEL_ORDER: Readonly<Record<string, readonly string[]>> = {
  pairOrientation: PAIR_ORIENTATION_LEVELS,
  pairing: PAIRING_LEVELS,
  mapq: [...MAPQ_BINS.map(b => b.key), MAPQ_UNAVAILABLE_LEVEL],
  split: SPLIT_LEVELS,
  spliced: SPLICED_LEVELS,
  svSignal: SV_SIGNAL_LEVELS,
}

/** A read field's own value order, after the values `domain` lists. */
export function levelOrder(field: string, domain: readonly string[] = []) {
  const own = LEVEL_ORDER[field]
  return own ? [...domain, ...own] : domain
}
