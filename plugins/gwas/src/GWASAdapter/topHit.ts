import type { Feature, Region } from '@jbrowse/core/util'

/** The name `GWASAdapter` reports a region's top hits under in a fetch's `facts`. */
export const TOP_HIT_FACT = 'gwasTopHits'

/**
 * How many equal bins of the fetched region each report a top hit. A fetch
 * reaches past the screen, so the display takes the best hit inside a visible
 * block; only the bin straddling a screen edge can hide an on-screen SNP behind
 * a stronger one off screen.
 */
export const TOP_HIT_BINS = 256

/** A highest-scoring SNP, by its 0-based start. */
export interface TopHit {
  start: number
  score: number
}

function beats(f: TopHit, top: TopHit | undefined) {
  return (
    !top ||
    f.score > top.score ||
    (f.score === top.score && f.start < top.start)
  )
}

/**
 * Each bin's highest-scoring feature, the lowest start among equals, in
 * ascending start: `negLog10` clamps every underflowed p of 0 to the same
 * ~323.3, so ties at the top are routine, and one broken by file order could
 * differ between two reads.
 */
export function topHitsOf(features: Feature[], region: Region) {
  const width = Math.max(1, region.end - region.start)
  const tops: (TopHit | undefined)[] = []
  for (const f of features) {
    const score: unknown = f.get('score')
    const start = f.get('start')
    if (typeof score === 'number' && Number.isFinite(score)) {
      const bin = Math.min(
        TOP_HIT_BINS - 1,
        Math.max(
          0,
          Math.floor(((start - region.start) * TOP_HIT_BINS) / width),
        ),
      )
      const hit = { start, score }
      if (beats(hit, tops[bin])) {
        tops[bin] = hit
      }
    }
  }
  return tops.filter(t => t !== undefined)
}

function isTopHit(hit: unknown): hit is TopHit {
  return (
    typeof hit === 'object' &&
    hit !== null &&
    'start' in hit &&
    typeof hit.start === 'number' &&
    'score' in hit &&
    typeof hit.score === 'number'
  )
}

export function readTopHits(facts: Record<string, unknown> | undefined) {
  const hits = facts?.[TOP_HIT_FACT]
  return Array.isArray(hits) ? hits.filter(isTopHit) : []
}
