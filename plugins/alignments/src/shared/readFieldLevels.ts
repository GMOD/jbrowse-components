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

/**
 * A `mapq` facet's bins, each keyed by its lowest score: real MAPQ is bimodal
 * at the aligner's ceiling and at 0, and these are the cuts people filter on
 * (`samtools view -q 10` / `-q 30`). Confident reads stack first.
 */
export const MAPQ_BINS = [
  { key: '30', min: 30, label: 'MAPQ 30+ (high confidence)' },
  { key: '10', min: 10, label: 'MAPQ 10-29' },
  { key: '1', min: 1, label: 'MAPQ 1-9 (low)' },
  { key: '0', min: 0, label: 'MAPQ 0 (multi-mapping)' },
] as const

/** The same bins lowest first, as a threshold scale lists its intervals. */
const MAPQ_BINS_ASCENDING = MAPQ_BINS.toReversed()

/** The cuts between the bins, which a `mapq` color's threshold scale reads. */
export const MAPQ_CUTS = MAPQ_BINS_ASCENDING.slice(1).map(b => b.key)

export const MAPQ_BIN_LABELS = MAPQ_BINS_ASCENDING.map(b => b.label)

export const SPLIT_READ_LEVELS = ['split', 'unsplit'] as const

const LEVEL_ORDER: Readonly<Record<string, readonly string[]>> = {
  pairOrientation: PAIR_ORIENTATION_LEVELS,
  mapq: [...MAPQ_BINS.map(b => b.key), MAPQ_UNAVAILABLE_LEVEL],
  splitRead: SPLIT_READ_LEVELS,
}

/** A read field's own value order, after the values `domain` lists. */
export function levelOrder(field: string, domain: readonly string[] = []) {
  const own = LEVEL_ORDER[field]
  return own ? [...domain, ...own] : domain
}
