import { parseModHeader } from './consts.ts'

const COMPLEMENT_CODE: Record<number, number> = {
  65: 84, // A->T
  84: 65, // T->A
  67: 71, // C->G
  71: 67, // G->C
  78: 78, // N->N
}

/**
 * Parse MM tag to extract modification positions on the read sequence.
 *
 *
 * @param mm - MM tag string (e.g., "C+m,2,2,1;A+a,0,3")
 * @param fseq - Read sequence
 * @param fstrand - Read strand (-1, 0, or 1)
 * @returns Array of modification objects with positions
 */
export function getModPositions(mm: string, fseq: string, fstrand: number) {
  const seqLength = fseq.length
  const isRev = fstrand === -1
  const mods = mm.split(';')
  const result: {
    type: string
    base: string
    strand: string
    positions: number[]
  }[] = []

  for (const mod of mods) {
    // Empty string
    if (mod === '') {
      continue
    }

    const split = mod.split(',')
    const basemod = split[0]!
    const { base, strand, typestr } = parseModHeader(basemod, mod)
    // Note: mod field ('.' or '?') indicates how skipped bases are interpreted
    // but for getModPositions we only need base, strand, and typestr

    // Note: Negative strand modifications (e.g., T-a) are now supported
    // They are processed the same way as positive strand modifications
    // The strand information is preserved for simplex/duplex detection

    // can be a multi e.g. C+mh for both meth (m) and hydroxymeth (h) so split,
    // and they can also be chemical codes (ChEBI) e.g. C+16061
    // Iterate directly over characters to avoid array creation for multi-type
    const isSingleType = typestr.charCodeAt(0) < 97 || typestr.length === 1

    // this logic based on parse_mm.pl from hts-specs
    const processType = (type: string) => {
      const splitLength = split.length
      let currPos = 0

      // Avoid revcom(fseq) by reading fseq from the back and complementing the
      // expected char-code on reverse strand.
      const baseCode = base.charCodeAt(0)
      const targetCode = isRev ? (COMPLEMENT_CODE[baseCode] ?? baseCode) : baseCode
      const isN = base === 'N'

      // For reverse strand, pre-allocate array and fill backwards to avoid reverse()
      // This is worthwhile because we avoid an O(n) reverse() operation
      const positions = isRev ? new Array(splitLength - 1) : []
      let writeIndex = isRev ? splitLength - 2 : 0

      for (let i = 1; i < splitLength; i++) {
        let delta = +split[i]!
        do {
          const seqCode = isRev
            ? fseq.charCodeAt(seqLength - 1 - currPos)
            : fseq.charCodeAt(currPos)
          if (isN || seqCode === targetCode) {
            delta--
          }
          currPos++
        } while (delta >= 0 && currPos < seqLength)

        // Calculate and store position
        if (isRev) {
          const pos = seqLength - currPos
          if (pos >= 0) {
            // avoid negative-number-positions in array, seen in #4629 cause
            // unknown, could warrant some further investigation
            positions[writeIndex--] = pos
          } else {
            // Position is negative (edge case from #4629)
            // Don't write anything, don't decrement writeIndex
            // This leaves a gap at the beginning of the array that we'll slice off
          }
        } else {
          positions[writeIndex++] = currPos - 1
        }
      }

      // For reverse strand, slice off any unfilled slots at the beginning
      // (happens when some positions were negative and skipped)
      const validPositions = isRev ? positions.slice(writeIndex + 1) : positions

      result.push({
        type,
        base,
        strand,
        positions: validPositions,
      })
    }

    if (isSingleType) {
      processType(typestr)
    } else {
      // Multi-char lowercase: each character is a separate type
      for (let j = 0, len = typestr.length; j < len; j++) {
        processType(typestr[j]!)
      }
    }
  }

  return result
}
