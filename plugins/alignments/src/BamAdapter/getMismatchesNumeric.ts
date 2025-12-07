import type { Mismatch } from '../shared/types'

// CIGAR operation indices (from BAM spec)
const CIGAR_M = 0
const CIGAR_I = 1
const CIGAR_D = 2
const CIGAR_N = 3
const CIGAR_S = 4
const CIGAR_H = 5
const CIGAR_EQ = 7
const CIGAR_X = 8

// Sequence decoder matching @gmod/bam format - returns strings
const SEQRET_STRING_DECODER = '=ACMGRSVTWYHKDBN'.split('')

// Numeric decoder - returns char codes directly (lowercase for case-insensitive comparison)
// '=' = 61, 'a' = 97, 'c' = 99, 'm' = 109, 'g' = 103, 'r' = 114, 's' = 115, 'v' = 118,
// 't' = 116, 'w' = 119, 'y' = 121, 'h' = 104, 'k' = 107, 'd' = 100, 'b' = 98, 'n' = 110
const SEQRET_NUMERIC_DECODER = new Uint8Array([
  61, 97, 99, 109, 103, 114, 115, 118, 116, 119, 121, 104, 107, 100, 98, 110,
])

// Optimized getMismatches that works directly with NUMERIC_SEQ and NUMERIC_CIGAR
// Avoids decoding the entire sequence string
export function getMismatchesNumeric(
  cigar: Uint32Array,
  numericSeq: Uint8Array,
  seqLength: number,
  md?: string,
  ref?: string,
  qual?: Uint8Array,
): Mismatch[] {
  const { mismatches, hasSkips } = cigarToMismatchesNumeric(
    cigar,
    numericSeq,
    seqLength,
    ref,
    qual,
  )

  // Parse MD tag if available
  if (md) {
    mdToMismatchesNumeric(
      md,
      cigar,
      mismatches,
      numericSeq,
      seqLength,
      hasSkips,
      qual,
    )
  }

  return mismatches
}

// Helper to get sequence slice from NUMERIC_SEQ
function getSeqSlice(
  numericSeq: Uint8Array,
  start: number,
  end: number,
  seqLength: number,
) {
  const actualEnd = Math.min(end, seqLength)
  const len = actualEnd - start
  if (len <= 0) {
    return ''
  }
  let result = ''
  for (let i = start; i < actualEnd; i++) {
    const sb = numericSeq[i >> 1]!
    const nibble = (sb >> ((1 - (i & 1)) << 2)) & 0xf
    result += SEQRET_STRING_DECODER[nibble]!
  }
  return result
}

function cigarToMismatchesNumeric(
  ops: Uint32Array,
  numericSeq: Uint8Array,
  seqLength: number,
  ref?: string,
  qual?: Uint8Array,
): { mismatches: Mismatch[]; hasSkips: boolean } {
  let roffset = 0
  let soffset = 0
  const mismatches: Mismatch[] = []
  let hasSkips = false
  const hasRef = !!ref
  for (let i = 0, l = ops.length; i < l; i++) {
    const packed = ops[i]!
    const len = packed >> 4
    const op = packed & 0xf

    if (op === CIGAR_M || op === CIGAR_EQ) {
      if (hasRef) {
        const endIdx = soffset + len
        const safeEnd = endIdx <= seqLength ? len : seqLength - soffset
        for (let j = 0; j < safeEnd; j++) {
          const seqIdx = soffset + j
          const sb = numericSeq[seqIdx >> 1]!
          const nibble = (sb >> ((1 - (seqIdx & 1)) << 2)) & 0xf
          const seqBaseCode = SEQRET_NUMERIC_DECODER[nibble]!
          const refBaseCode = ref.charCodeAt(roffset + j) | 0x20
          if (seqBaseCode !== refBaseCode) {
            mismatches.push({
              start: roffset + j,
              type: 'mismatch',
              base: SEQRET_STRING_DECODER[nibble]!,
              altbase: ref[roffset + j]!,
              length: 1,
            })
          }
        }
      }
      soffset += len
      roffset += len
    } else if (op === CIGAR_I) {
      mismatches.push({
        start: roffset,
        type: 'insertion',
        base: `${len}`,
        insertedBases: getSeqSlice(
          numericSeq,
          soffset,
          soffset + len,
          seqLength,
        ),
        length: 0,
      })
      soffset += len
    } else if (op === CIGAR_D) {
      mismatches.push({
        start: roffset,
        type: 'deletion',
        base: '*',
        length: len,
      })
      roffset += len
    } else if (op === CIGAR_N) {
      hasSkips = true
      mismatches.push({
        start: roffset,
        type: 'skip',
        base: 'N',
        length: len,
      })
      roffset += len
    } else if (op === CIGAR_X) {
      for (let j = 0; j < len; j++) {
        const seqIdx = soffset + j
        const sb = numericSeq[seqIdx >> 1]!
        const nibble = (sb >> ((1 - (seqIdx & 1)) << 2)) & 0xf
        mismatches.push({
          start: roffset + j,
          type: 'mismatch',
          base: SEQRET_STRING_DECODER[nibble]!,
          qual: qual?.[seqIdx],
          length: 1,
        })
      }
      soffset += len
      roffset += len
    } else if (op === CIGAR_H) {
      mismatches.push({
        start: roffset,
        type: 'hardclip',
        base: `H${len}`,
        cliplen: len,
        length: 1,
      })
    } else if (op === CIGAR_S) {
      mismatches.push({
        start: roffset,
        type: 'softclip',
        base: `S${len}`,
        cliplen: len,
        length: 1,
      })
      soffset += len
    }
  }

  return { mismatches, hasSkips }
}

function mdToMismatchesNumeric(
  mdstring: string,
  ops: Uint32Array,
  mismatches: Mismatch[],
  numericSeq: Uint8Array,
  seqLength: number,
  hasSkips: boolean,
  qual?: Uint8Array,
) {
  const opsLength = ops.length
  const hasQual = qual !== undefined
  const cigarLength = mismatches.length

  let currStart = 0
  let lastCigar = 0
  let lastTemplateOffset = 0
  let lastRefOffset = 0
  let lastSkipPos = 0

  // Parse MD string
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
        i++
        currStart++
      }
    } else if (char >= 65) {
      // letter (mismatch)
      const letter = String.fromCharCode(char)
      i++

      // Handle skips
      if (hasSkips && cigarLength > 0) {
        for (let k = lastSkipPos; k < cigarLength; k++) {
          const m = mismatches[k]!
          if (m.type === 'skip' && currStart >= m.start) {
            currStart += m.length
            lastSkipPos = k
          }
        }
      }

      // Find position in read
      let templateOffset = lastTemplateOffset
      let refOffset = lastRefOffset
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
        } else if (op === CIGAR_D || op === 6 || op === CIGAR_N) {
          // D, P, N
          refOffset += len
        } else if (op !== CIGAR_H) {
          templateOffset += len
          refOffset += len
        }
      }
      lastTemplateOffset = templateOffset
      lastRefOffset = refOffset
      const s = templateOffset - (refOffset - currStart)

      let base: string
      if (s < seqLength) {
        const sb = numericSeq[s >> 1]!
        const nibble = (sb >> ((1 - (s & 1)) << 2)) & 0xf
        base = SEQRET_STRING_DECODER[nibble]!
      } else {
        base = 'X'
      }
      mismatches.push({
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
}
