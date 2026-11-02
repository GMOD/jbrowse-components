import { MAPQ_BINS } from '@jbrowse/core/util/colorScale'

import type { PairDirection } from '@jbrowse/alignments-core'

/**
 * The values a categorical read field takes, in its own order, shared by
 * every channel naming the field: a `facet` section is keyed by one and
 * `encoding.color.scale.domain` names one, so `domain: ['RR']` over
 * `pairOrientation` means the same thing under both. A domain lists its values first and the
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
 * read, an indel of 50 bp or more, a discordant pair, or none. Each needs both
 * ends placed (ADR-229), so `splitRead` is narrower than `split: 'split'`
 * and `discordantPair` than `pairing: 'discordant'`, and the names differ.
 */
export const SV_SIGNAL_LEVELS = [
  'splitRead',
  'svIndel',
  'discordantPair',
  'none',
] as const

export type SvSignal = (typeof SV_SIGNAL_LEVELS)[number]

/** The level `svSignalTier`'s tier names, 0 for none. */
export const SV_SIGNAL_OF_TIER: readonly SvSignal[] = [
  'none',
  'discordantPair',
  'svIndel',
  'splitRead',
]

/**
 * `svSignal`'s evidence split by the kind of SV it points at, one band per
 * kind: a pair by its orientation, a split read by its junctions' class filed
 * with the pairs across the same junction, a partner on another reference, an
 * SV-size insertion, or none. LL and RR, the two ends of one inversion, share a
 * band; their arcs keep them apart.
 */
export const SV_CHANNEL_LEVELS = [
  'LR',
  'RL',
  'inversion',
  'otherChromosome',
  'svInsertion',
  'none',
] as const

export type SvChannel = (typeof SV_CHANNEL_LEVELS)[number]

type Labelled<L extends readonly string[]> = Readonly<Record<L[number], string>>

/** Each level's name, as a facet section prints it. */
export const READ_LEVEL_LABELS: {
  split: Labelled<typeof SPLIT_LEVELS>
  spliced: Labelled<typeof SPLICED_LEVELS>
  pairing: Labelled<typeof PAIRING_LEVELS>
  svChannel: Labelled<typeof SV_CHANNEL_LEVELS>
} = {
  split: { split: 'Split (SA)', unsplit: 'Not split' },
  spliced: { spliced: 'Spliced', unspliced: 'Not spliced' },
  pairing: {
    concordant: 'Concordant',
    discordant: 'Discordant',
    unpaired: 'Unpaired',
    nonPrimary: 'Secondary or supplementary',
  },
  svChannel: {
    LR: 'LR pair or deletion-type split',
    RL: 'RL pair or duplication-type split',
    inversion: 'LL or RR pair, or inversion split',
    otherChromosome: 'Partner on another chromosome',
    svInsertion: 'SV-size insertion',
    none: 'No SV evidence',
  },
}

const LEVEL_ORDER: Readonly<Record<string, readonly string[]>> = {
  pairOrientation: PAIR_ORIENTATION_LEVELS,
  pairing: PAIRING_LEVELS,
  mapq: [...MAPQ_BINS.map(b => b.key), MAPQ_UNAVAILABLE_LEVEL],
  split: SPLIT_LEVELS,
  spliced: SPLICED_LEVELS,
  svChannel: SV_CHANNEL_LEVELS,
}

/** A read field's own value order, after the values `domain` lists. */
export function levelOrder(field: string, domain: readonly string[] = []) {
  const own = LEVEL_ORDER[field]
  return own ? [...domain, ...own] : domain
}
