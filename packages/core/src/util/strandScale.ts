import type { Feature } from './simpleFeature.ts'

/**
 * #api
 * Strand as a categorical color field: the values a feature carries, the
 * colors strand coloring paints them (red forward, blue reverse, the
 * vocabulary the synteny ribbons paint too) and the names a key gives them.
 */
export const STRAND_FIELD = 'strand'

/** #api */
export const STRAND_DOMAIN = ['1', '-1', '0']

/** #api */
export const STRAND_PALETTE = ['tomato', 'cornflowerblue', 'goldenrod']

const STRAND_LABELS: Readonly<Record<string, string>> = {
  '1': 'Forward strand',
  '-1': 'Reverse strand',
  '0': 'No strand',
}

/**
 * #api
 * How a key names a strand value, or undefined for a value that is none.
 */
export function strandLabel(value: string) {
  return STRAND_LABELS[value]
}

/**
 * #api
 * A feature's strand as the scale reads it: one with none is unstranded.
 */
export function readStrand(feature: Feature): unknown {
  return feature.get('strand') ?? 0
}
