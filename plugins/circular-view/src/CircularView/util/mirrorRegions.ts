import type { Region } from '@jbrowse/core/util'

/**
 * One arc's regions, laid out the other way round the circle: reverse order,
 * each region drawn from its last base to its first.
 *
 * This is what a two-genome circle needs and a synteny row does not.
 * `diagonalizeRegions` answers for a linear panel — an order and a per-region
 * `reversed` such that the alignment reads monotonically along the reference
 * beside it. Both arcs of a circle run the same way round, so applying that
 * answer directly sends each matching pair to a pair of ANTIPODAL points: every
 * ribbon becomes a diameter and the figure crosses at the centre, which is what
 * the undiagonalized human-mouse circle looked like. Chords between two arcs
 * never cross when one side's coordinate rises with the angle and the other's
 * falls, so the second genome is mirrored and the ribbons come out as a band of
 * roughly parallel arcs.
 *
 * An involution: mirroring twice is the identity, which is what lets the reorder
 * mirror the circle's regions back into linear order, ask the shared algorithm,
 * and mirror its answer forward again.
 */
export function mirrorRegionsForCircle(regions: Region[]): Region[] {
  return regions.map(r => ({ ...r, reversed: !r.reversed })).reverse()
}
