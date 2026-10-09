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
