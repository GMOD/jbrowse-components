import { revcom } from '@jbrowse/core/util'

import { modificationRegex } from './consts.ts'

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
  const seq = fstrand === -1 ? revcom(fseq) : fseq
  const seqLength = seq.length
  const mods = mm.split(';')
  const result = []

  for (const mod of mods) {
    // Empty string
    if (mod === '') {
      continue
    }

    const split = mod.split(',')
    const basemod = split[0]!
    const matches = modificationRegex.exec(basemod)
    if (!matches) {
      throw new Error(`bad format for MM tag: "${mod}"`)
    }
    const [, base, strand, typestr] = matches

    // can be a multi e.g. C+mh for both meth (m) and hydroxymeth (h) so split,
    // and they can also be chemical codes (ChEBI) e.g. C+16061
    const types = typestr!.split(/(\d+|.)/)

    // Note: Negative strand modifications (e.g., T-a) are now supported
    // They are processed the same way as positive strand modifications
    // The strand information is preserved for simplex/duplex detection

    // this logic based on parse_mm.pl from hts-specs
    for (const type of types) {
      if (type === '') {
        continue
      }

      const splitLength = split.length
      let currPos = 0

      // For reverse strand, pre-allocate array and fill backwards to avoid reverse()
      // This is worthwhile because we avoid an O(n) reverse() operation
      const positions = fstrand === -1 ? new Array(splitLength - 1) : []
      let writeIndex = fstrand === -1 ? splitLength - 2 : 0

      for (let i = 1; i < splitLength; i++) {
        let delta = +split[i]!
        do {
          if (base === 'N' || base === seq[currPos]) {
            delta--
          }
          currPos++
        } while (delta >= 0 && currPos < seqLength)

        // Calculate and store position
        if (fstrand === -1) {
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
      const validPositions =
        fstrand === -1 ? positions.slice(writeIndex + 1) : positions

      result.push({
        type,
        base: base!,
        strand: strand!,
        positions: validPositions,
      })
    }
  }

  return result
}
