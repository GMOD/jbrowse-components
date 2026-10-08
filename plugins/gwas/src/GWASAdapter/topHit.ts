import type { Feature } from '@jbrowse/core/util'

/** The name `GWASAdapter` reports a region's top hit under in a fetch's `facts`. */
export const TOP_HIT_FACT = 'gwasTopHit'

/** A region's highest-scoring SNP, by its 0-based start. */
export interface TopHit {
  start: number
  score: number
}

/**
 * The highest-scoring feature, the lowest start among equals: `negLog10`
 * clamps every underflowed p of 0 to the same ~323.3, so ties at the top are
 * routine, and one broken by file order could differ between two reads.
 */
export function topHitOf(features: Feature[]) {
  let top: TopHit | undefined
  for (const f of features) {
    const score: unknown = f.get('score')
    const start = f.get('start')
    if (
      typeof score === 'number' &&
      Number.isFinite(score) &&
      (!top || score > top.score || (score === top.score && start < top.start))
    ) {
      top = { start, score }
    }
  }
  return top
}

export function readTopHit(
  facts: Record<string, unknown> | undefined,
): TopHit | undefined {
  const hit = facts?.[TOP_HIT_FACT]
  return typeof hit === 'object' &&
    hit !== null &&
    'start' in hit &&
    typeof hit.start === 'number' &&
    'score' in hit &&
    typeof hit.score === 'number'
    ? { start: hit.start, score: hit.score }
    : undefined
}
