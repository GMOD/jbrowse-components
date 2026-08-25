import { junctionLocations } from './BreakpointPair.tsx'

import type { ReadVsRefFeature } from '@jbrowse/cigar-utils'

/**
 * The junctions between read-adjacent segments, in the order the molecule
 * crosses them. `buildReadVsRefFeatures` puts every segment in the clicked
 * record's reference orientation, so for a minus-strand record its list walks
 * the read 3'→5' with every strand flipped; both are undone here so a
 * junction's from/to is the direction the read actually takes.
 */
export function splitReadJunctions(
  features: ReadVsRefFeature[],
  readStrand: number | undefined,
) {
  const inReadOrder =
    readStrand === -1
      ? [...features].reverse().map(f => ({ ...f, strand: -f.strand }))
      : features
  return inReadOrder.slice(0, -1).map((f1, i) => {
    const f2 = inReadOrder[i + 1]!
    return {
      f1,
      f2,
      from: junctionLocations(f1).downstream,
      to: junctionLocations(f2).upstream,
    }
  })
}
