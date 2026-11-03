/**
 * Summed off the drawn arcs, so the count matches the picture. Read names in
 * both windows would also count reads split to other loci.
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
