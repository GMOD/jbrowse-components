import { flipCigar, swapIndelCigar } from './cigarReorient.ts'
import { flipCs } from './csOps.ts'
import { csToCigar } from './csToCigar.ts'

// Resolve a PAF row's alignment detail into the perspective the view is anchored
// on. `flip` is set when viewing the query assembly. A cg CIGAR is used when
// present, otherwise one is derived from cs. cs (real per-base diffs) maps
// directly in the target perspective; in the query perspective it is flipped,
// except reverse-strand which additionally needs a reverse-complement we don't
// do — there cs is dropped and the flipped CIGAR carries mismatch positions.
// flipCs drops it too when the row states an intron, which is a reference gap
// that the query perspective has no way to write.
export function orientAlignment({
  cg,
  cs,
  flip,
  strand,
}: {
  cg: string | undefined
  cs: string | undefined
  flip: boolean
  strand: number
}) {
  let CIGAR = cg ?? (cs ? csToCigar(cs) : undefined)
  let orientedCs = cs
  if (CIGAR && flip) {
    if (strand === -1) {
      CIGAR = flipCigar(CIGAR)
      orientedCs = undefined
    } else {
      CIGAR = swapIndelCigar(CIGAR)
      orientedCs = cs ? flipCs(cs) : undefined
    }
  }
  return { CIGAR, cs: orientedCs }
}
