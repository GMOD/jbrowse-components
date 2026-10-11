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

const LEVEL_ORDER: Readonly<Record<string, readonly string[]>> = {
  pairOrientation: PAIR_ORIENTATION_LEVELS,
  pairing: PAIRING_LEVELS,
  mapq: [...MAPQ_BINS.map(b => b.key), MAPQ_UNAVAILABLE_LEVEL],
  split: SPLIT_LEVELS,
  spliced: SPLICED_LEVELS,
}

/** A read field's own value order, after the values `domain` lists. */
export function levelOrder(field: string, domain: readonly string[] = []) {
  const own = LEVEL_ORDER[field]
  return own ? [...domain, ...own] : domain
}
