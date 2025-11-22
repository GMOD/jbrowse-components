import type { Mismatch } from '../shared/types'
import { CIGAR_S, CIGAR_I, CIGAR_D, CIGAR_P, CIGAR_N, CIGAR_H } from './index'

// Optimized version that works with parseCigar2 output (numeric ops)
export function mdToMismatches2(
  mdstring: string,
  ops: number[],
  cigarMismatches: Mismatch[],
  seq: string,
  qual?: Uint8Array,
) {
  const mismatchRecords: Mismatch[] = []
  const opsLength = ops.length
  const seqLength = seq.length
  const hasQual = qual !== undefined

  // only check for skips if cigarMismatches has any
  const cigarLength = cigarMismatches.length
  let hasSkips = false
  for (let k = 0; k < cigarLength; k++) {
    if (cigarMismatches[k]!.type === 'skip') {
      hasSkips = true
      break
    }
  }

  let currStart = 0
  let lastCigar = 0
  let lastTemplateOffset = 0
  let lastRefOffset = 0
  let lastSkipPos = 0

  // parse the MD string manually for better performance
  let i = 0
  const len = mdstring.length
  while (i < len) {
    const char = mdstring.charCodeAt(i)

    if (char >= 48 && char <= 57) {
      // digit (0-9)
      let num = 0
      while (i < len) {
        const c = mdstring.charCodeAt(i)
        if (c >= 48 && c <= 57) {
          num = num * 10 + (c - 48)
          i++
        } else {
          break
        }
      }
      currStart += num
    } else if (char === 94) {
      // '^' - deletion
      i++
      while (i < len && mdstring.charCodeAt(i) >= 65) {
        // skip deleted bases (A-Z, a-z)
        i++
        currStart++
      }
    } else if (char >= 65) {
      // letter (mismatch)
      const letter = mdstring[i]!

      // handle skips in cigar
      if (hasSkips && cigarLength > 0) {
        for (let k = lastSkipPos; k < cigarLength; k++) {
          const mismatch = cigarMismatches[k]!
          if (mismatch.type === 'skip' && currStart >= mismatch.start) {
            currStart += mismatch.length
            lastSkipPos = k
          }
        }
      }

      // find position in read that corresponds to currStart
      let templateOffset = lastTemplateOffset
      let refOffset = lastRefOffset
      for (
        let j = lastCigar;
        j < opsLength && refOffset <= currStart;
        j += 2, lastCigar = j
      ) {
        const len = ops[j]!
        const op = ops[j + 1]!

        if (op === CIGAR_S || op === CIGAR_I) {
          templateOffset += len
        } else if (op === CIGAR_D || op === CIGAR_P || op === CIGAR_N) {
          refOffset += len
        } else if (op !== CIGAR_H) {
          templateOffset += len
          refOffset += len
        }
      }
      lastTemplateOffset = templateOffset
      lastRefOffset = refOffset
      const s = templateOffset - (refOffset - currStart)

      const base = s < seqLength ? seq[s]! : 'X'
      mismatchRecords.push({
        start: currStart,
        base,
        qual: hasQual ? qual[s] : undefined,
        altbase: letter,
        length: 1,
        type: 'mismatch',
      })

      currStart++
    } else {
      i++
    }
  }
  return mismatchRecords
}
