import type { Region } from '@jbrowse/core/util'

/**
 * One base past the start for a zero-length feature, its own end otherwise:
 * interbase `[start, end)` is empty when the two are equal, so a bare
 * containment test answers "nothing here" over a block both painters draw.
 * Genomic bp only — a painter's pixel-space widening is a different rule.
 */
export function featureSpanEndBp(start: number, end: number) {
  return Math.max(end, start + 1)
}

/**
 * A zero-length feature is straddled rather than grown from its start edge:
 * adapters keep a feature on `end > queryStart && start < queryEnd`, and a
 * query of [pos, pos + 1] fails the first half against a feature whose own end
 * is pos, dropping exactly the feature the widening was for.
 */
export function featureSpanRegion(
  region: Region,
  startBp: number,
  endBp: number,
): Region {
  return {
    ...region,
    start: endBp > startBp ? startBp : Math.max(0, startBp - 1),
    end: featureSpanEndBp(startBp, endBp),
  }
}
