/**
 * The read dimensions a facet names, each with its own partitioner
 * (`groupFeatures.ts`), and the filter tests by the same keys
 * (`filterFields.ts`). Any other `field` is a tag (`tags.HP`) or a feature
 * field. `alone` filters but sections nothing: each window judges it on its
 * own, so a read can be alone in two windows and its section would move as
 * regions load. This module imports nothing, so `jbrowse validate` carries it
 * with the filter's rules.
 */
export const READ_DIMENSIONS = [
  'strand',
  'firstOfPairStrand',
  'pairOrientation',
  'pairing',
  'split',
  'spliced',
  'svKind',
  'mapq',
  'mateRefName',
  'mateAssembly',
] as const
export type ReadDimension = (typeof READ_DIMENSIONS)[number]

/**
 * The values a categorical read field takes, in its own order, shared by
 * every channel naming the field: a `facet` section is keyed by one,
 * `encoding.color.scale.domain` and a `filter` entry name one, so `domain:
 * ['RR']` over `pairOrientation` means the same thing under each. A domain
 * lists its values first and the rest follow this order. These are
 * alignments-core's `PairDirection`s.
 */
export const PAIR_ORIENTATION_LEVELS = ['LR', 'RL', 'RR', 'LL'] as const

/**
 * A forward and a reverse read: core's universal `strand` keys, less the
 * unstranded `0`, which a read's section never takes.
 */
export const STRAND_LEVELS = ['1', '-1'] as const

export const INSERT_SIZE_LEVELS = ['short', 'normal', 'long'] as const

/** SAM's "mapping quality unavailable", a level of its own on every channel. */
export const MAPQ_UNAVAILABLE_LEVEL = '255'

export const SPLIT_LEVELS = ['split', 'unsplit'] as const

export const SPLICED_LEVELS = ['spliced', 'unspliced'] as const

/**
 * Where a read stands in its pair. `concordant` is the aligner's verdict
 * (`isConcordantPairRead`), so a file whose aligner never sets the proper-pair
 * flag files every pair `discordant`, and a read whose mate is unmapped is
 * `discordant` too. `unpaired` is a single-end record or one that is itself
 * unmapped. `nonPrimary` is a secondary or supplementary record, whose own
 * flags and orientation do not describe its pair.
 */
export const PAIRING_LEVELS = [
  'concordant',
  'discordant',
  'unpaired',
  'nonPrimary',
] as const

export type Pairing = (typeof PAIRING_LEVELS)[number]

/**
 * `svSignal`'s evidence split by the kind of SV it points at, one band per
 * kind: a discordant pair by its orientation and, for an LR pair, its insert
 * size, a split read by its junctions' class filed with the pairs across the
 * same junction, a partner on another reference or unmapped, an SV-size
 * insertion, and every read without evidence as `none`. LL and RR, the two ends
 * of one inversion, share a band; their arcs keep them apart.
 */
export const SV_KIND_LEVELS = [
  'deletionType',
  'duplicationType',
  'inversion',
  'elsewhere',
  'insertion',
  'none',
] as const

export type SvKind = (typeof SV_KIND_LEVELS)[number]

type Labelled<L extends readonly string[]> = Readonly<Record<L[number], string>>

/** Each level's name, as a facet section prints it. */
export const READ_LEVEL_LABELS: {
  split: Labelled<typeof SPLIT_LEVELS>
  spliced: Labelled<typeof SPLICED_LEVELS>
  pairing: Labelled<typeof PAIRING_LEVELS>
  svKind: Labelled<typeof SV_KIND_LEVELS>
} = {
  split: { split: 'Split (SA)', unsplit: 'Not split' },
  spliced: { spliced: 'Spliced', unspliced: 'Not spliced' },
  pairing: {
    concordant: 'Concordant',
    discordant: 'Discordant',
    unpaired: 'Unpaired',
    nonPrimary: 'Secondary or supplementary',
  },
  svKind: {
    deletionType: 'Deletion-type: LR pair, split or CIGAR deletion',
    duplicationType: 'Duplication-type: RL pair or split',
    inversion: 'Inversion: LL or RR pair, or split',
    elsewhere: 'Partner on another chromosome or unmapped',
    insertion: 'Insertion: pair too close, or SV-size insertion',
    none: 'No SV evidence',
  },
}

/**
 * Each closed read dimension's levels. `mapq`'s are core's bins, which the
 * facet adds (`sectionOrder`), and the data names `mateRefName`'s and
 * `mateAssembly`'s.
 */
export const DIMENSION_LEVELS: Readonly<Record<string, readonly string[]>> = {
  strand: STRAND_LEVELS,
  firstOfPairStrand: STRAND_LEVELS,
  pairOrientation: PAIR_ORIENTATION_LEVELS,
  pairing: PAIRING_LEVELS,
  split: SPLIT_LEVELS,
  spliced: SPLICED_LEVELS,
  svKind: SV_KIND_LEVELS,
} satisfies Partial<Record<ReadDimension, readonly string[]>>
