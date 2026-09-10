import type { Region } from '@jbrowse/core/util'

/**
 * One arc's regions, laid out the other way round the circle: reverse order,
 * each region drawn from its last base to its first.
 *
 * Chords between two arcs never cross when one side's coordinate rises with the
 * angle and the other's falls, so this is what a two-genome circle needs on top
 * of the linear reorder `diagonalizeRegions` answers with. ADR-121.
 *
 * An involution, which is what lets the reorder mirror the circle's regions back
 * into linear order, ask, and mirror the answer forward again.
 */
export function mirrorRegionsForCircle(regions: Region[]): Region[] {
  return regions.map(r => ({ ...r, reversed: !r.reversed })).reverse()
}
