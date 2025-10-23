import { revcom } from '@jbrowse/core/util'

import { modificationRegex } from './consts'

/**
 * Parse MM tag to extract modification positions on the read sequence.
 *
 * Performance optimizations:
 * - Pre-converts delta strings to numbers (avoids repeated +string coercion)
 * - Uses push + reverse instead of unshift (O(n) vs O(n²) for reverse strand)
 * - Caches sequence length to avoid repeated property access
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

    // Pre-convert deltas to numbers for performance (avoid repeated string-to-number conversion)
    const deltas = new Array(split.length - 1)
    for (let i = 1; i < split.length; i++) {
      deltas[i - 1] = +split[i]!
    }

    // this logic based on parse_mm.pl from hts-specs
    for (const type of types) {
      if (type === '') {
        continue
      }
      let currPos = 0
      const positions = []
      const deltasLength = deltas.length

      for (let i = 0; i < deltasLength; i++) {
        let delta = deltas[i]
        do {
          if (base === 'N' || base === seq[currPos]) {
            delta--
          }
          currPos++
        } while (delta >= 0 && currPos < seqLength)

        // Store position
        if (fstrand === -1) {
          const pos = seqLength - currPos
          if (pos >= 0) {
            // avoid negative-number-positions in array, seen in #4629 cause
            // unknown, could warrant some further investigation
            positions.push(pos)
          }
        } else {
          positions.push(currPos - 1)
        }
      }

      // Reverse positions array for reverse strand in one operation (more efficient than unshift)
      if (fstrand === -1) {
        positions.reverse()
      }

      result.push({
        type,
        base: base!,
        strand: strand!,
        positions,
      })
    }
  }

  return result
}
