import type { Mismatch } from '../shared/types'

// CIGAR operation indices (from BAM spec)
const CIGAR_I = 1
const CIGAR_D = 2
const CIGAR_N = 3
const CIGAR_S = 4
const CIGAR_H = 5
const CIGAR_P = 6

// Handles packed NUMERIC_CIGAR format from @gmod/bam
// Format: Uint32Array where each value is (length << 4) | opIndex
// opIndex is 0-8: M=0, I=1, D=2, N=3, S=4, H=5, P=6, ==7, X=8
export function mdToMismatches2(
  mdstring: string,
  ops: Uint32Array | undefined,
  cigarMismatches: Mismatch[],
  seq: string,
  qual?: Uint8Array,
) {
  if (!ops) {
    return []
  }

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
      i++

      // handle skips in cigar
      if (hasSkips && cigarLength > 0) {
        for (let k = lastSkipPos; k < cigarLength; k++) {
          const mismatch = cigarMismatches[k]!
          if (
            mismatch.type === 'skip' &&
            currStart >= mismatch.start
          ) {
            currStart += mismatch.length
            lastSkipPos = k
          }
        }
      }

      // find position in read that corresponds to currStart
      let templateOffset = lastTemplateOffset
      let refOffset = lastRefOffset

      // Packed format: each element is (length << 4) | opIndex
      for (
        let j = lastCigar;
        j < opsLength && refOffset <= currStart;
        j++, lastCigar = j
      ) {
        const packed = ops[j]!
        const len = packed >> 4
        const op = packed & 0xf

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
