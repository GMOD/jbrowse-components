/**
 * The reads behind the arcs a track draws between two displayed regions: one
 * `support` an arc, summed over the track's lanes. The number is the picture's
 * by construction. Counting read names with an alignment in both windows
 * instead read 10 at a collapsed repeat on COLO829 chr2 whose reads split to
 * other loci, under a band with no arc across the seam.
 *
 * `arcsByLane` is the display's `crossRegionArcsByGroup`.
 */
export function readsJoiningRegions(
  arcsByLane: ReadonlyMap<string, readonly { support: number }[]>,
) {
  let reads = 0
  for (const arcs of arcsByLane.values()) {
    for (const arc of arcs) {
      reads += arc.support
    }
  }
  return reads
}
