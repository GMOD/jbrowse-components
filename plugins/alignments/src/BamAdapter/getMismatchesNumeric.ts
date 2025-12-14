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

// Pre-computed lookup table for 2-base combinations in a single byte
// This is faster for small insertions (1-2 bases) which are very common
const TWO_BASE_LOOKUP: string[] = new Array(256)
for (let i = 0; i < 256; i++) {
  const high = (i >> 4) & 0xf
  const low = i & 0xf
  TWO_BASE_LOOKUP[i] =
    SEQRET_STRING_DECODER[high]! + SEQRET_STRING_DECODER[low]!
}

// Numeric decoder - returns char codes directly (lowercase for case-insensitive comparison)
// '=' = 61, 'a' = 97, 'c' = 99, 'm' = 109, 'g' = 103, 'r' = 114, 's' = 115, 'v' = 118,
// 't' = 116, 'w' = 119, 'y' = 121, 'h' = 104, 'k' = 107, 'd' = 100, 'b' = 98, 'n' = 110
const SEQRET_NUMERIC_DECODER = new Uint8Array([
  61, 97, 99, 109, 103, 114, 115, 118, 116, 119, 121, 104, 107, 100, 98, 110,
])

// Optimized getMismatches that works directly with NUMERIC_SEQ and NUMERIC_CIGAR
// Avoids decoding the entire sequence string
export function getMismatchesNumeric(
  cigar: ArrayLike<number>,
  numericSeq: ArrayLike<number>,
  seqLength: number,
  md?: string,
  ref?: string,
  qual?: ArrayLike<number> | null,
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

/**
 * Optimized getMismatches that accepts NUMERIC_MD (ArrayLike<number>) directly.
 * Avoids parsing all BAM tags and string conversion overhead.
 */
export function getMismatchesFromNumericMD(
  cigar: ArrayLike<number>,
  numericSeq: ArrayLike<number>,
  seqLength: number,
  numericMD: ArrayLike<number> | undefined,
  ref?: string,
  qual?: ArrayLike<number> | null,
): Mismatch[] {
  // Fast path: combined single-pass when MD is available and no ref comparison needed
  if (numericMD && numericMD.length > 0 && !ref) {
    return getMismatchesCombinedFromBytes(
      cigar,
      numericSeq,
      seqLength,
      numericMD,
      qual,
    )
  }

  // Standard two-pass approach
  const { mismatches, hasSkips } = cigarToMismatchesNumeric(
    cigar,
    numericSeq,
    seqLength,
    ref,
    qual,
  )

  // Parse MD tag directly from bytes if available
  if (numericMD && numericMD.length > 0) {
    mdToMismatchesFromBytes(
      numericMD,
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

/**
 * Combined single-pass CIGAR+MD processing.
 * Processes CIGAR and MD simultaneously, avoiding re-walking CIGAR for each mismatch.
 * ~1.15-1.56x faster than the two-pass approach depending on read characteristics.
 */
function getMismatchesCombinedFromBytes(
  cigar: ArrayLike<number>,
  numericSeq: ArrayLike<number>,
  seqLength: number,
  md: ArrayLike<number>,
  qual?: ArrayLike<number> | null,
): Mismatch[] {
  const mismatches: Mismatch[] = []
  const mdLength = md.length
  const hasQual = !!qual

  let roffset = 0
  let soffset = 0
  let mdIdx = 0
  let mdMatchRemaining = 0

  // Inline initial number parse
  while (mdIdx < mdLength) {
    const c = md[mdIdx]!
    if (c >= 48 && c <= 57) {
      mdMatchRemaining = mdMatchRemaining * 10 + (c - 48)
      mdIdx++
    } else {
      break
    }
  }

  for (let i = 0, l = cigar.length; i < l; i++) {
    const packed = cigar[i]!
    const len = packed >> 4
    const op = packed & 0xf

    if (op === CIGAR_M || op === CIGAR_EQ) {
      let remaining = Math.min(len, seqLength - soffset)
      let localOffset = 0

      while (remaining > 0) {
        if (mdMatchRemaining >= remaining) {
          mdMatchRemaining -= remaining
          localOffset += remaining
          remaining = 0
        } else {
          localOffset += mdMatchRemaining
          remaining -= mdMatchRemaining
          mdMatchRemaining = 0

          if (mdIdx < mdLength && md[mdIdx]! >= 65 && md[mdIdx]! <= 90) {
            const seqIdx = soffset + localOffset
            const sb = numericSeq[seqIdx >> 1]!
            const nibble = (sb >> ((1 - (seqIdx & 1)) << 2)) & 0xf
            mismatches.push({
              start: roffset + localOffset,
              type: 'mismatch',
              base: SEQRET_STRING_DECODER[nibble]!,
              altbase: String.fromCharCode(md[mdIdx]!),
              qual: hasQual ? qual[seqIdx] : undefined,
              length: 1,
            })
            mdIdx++
            localOffset++
            remaining--
            // Inline number parse
            mdMatchRemaining = 0
            while (mdIdx < mdLength) {
              const c = md[mdIdx]!
              if (c >= 48 && c <= 57) {
                mdMatchRemaining = mdMatchRemaining * 10 + (c - 48)
                mdIdx++
              } else {
                break
              }
            }
          } else {
            break
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
      // eslint-disable-next-line @typescript-eslint/no-confusing-non-null-assertion
      if (mdIdx < mdLength && md[mdIdx]! === 94) {
        mdIdx++
        while (mdIdx < mdLength && md[mdIdx]! >= 65) {
          mdIdx++
        }
        // Inline number parse
        mdMatchRemaining = 0
        while (mdIdx < mdLength) {
          const c = md[mdIdx]!
          if (c >= 48 && c <= 57) {
            mdMatchRemaining = mdMatchRemaining * 10 + (c - 48)
            mdIdx++
          } else {
            break
          }
        }
      }
      roffset += len
    } else if (op === CIGAR_N) {
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

        let altbase: string | undefined
        if (mdMatchRemaining === 0 && mdIdx < mdLength && md[mdIdx]! >= 65) {
          altbase = String.fromCharCode(md[mdIdx]!)
          mdIdx++
          // Inline number parse
          mdMatchRemaining = 0
          while (mdIdx < mdLength) {
            const c = md[mdIdx]!
            if (c >= 48 && c <= 57) {
              mdMatchRemaining = mdMatchRemaining * 10 + (c - 48)
              mdIdx++
            } else {
              break
            }
          }
        } else if (mdMatchRemaining > 0) {
          mdMatchRemaining--
        }

        mismatches.push({
          start: roffset + j,
          type: 'mismatch',
          base: SEQRET_STRING_DECODER[nibble]!,
          altbase,
          qual: hasQual ? qual[seqIdx] : undefined,
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

  return mismatches
}

// Helper to get sequence slice from NUMERIC_SEQ
// Optimized fast paths for 1-2 base insertions which are the common case
function getSeqSlice(
  numericSeq: ArrayLike<number>,
  start: number,
  end: number,
  seqLength: number,
) {
  const actualEnd = Math.min(end, seqLength)
  const len = actualEnd - start
  if (len <= 0) {
    return ''
  }

  // Fast path for single base (very common for 1bp insertions)
  if (len === 1) {
    const sb = numericSeq[start >> 1]!
    const nibble = (sb >> ((1 - (start & 1)) << 2)) & 0xf
    return SEQRET_STRING_DECODER[nibble]!
  }

  // Fast path for 2 bases in same byte (common for 2bp insertions at even positions)
  if (len === 2 && (start & 1) === 0) {
    const sb = numericSeq[start >> 1]!
    return TWO_BASE_LOOKUP[sb]!
  }

  // General case for longer sequences
  let result = ''
  for (let i = start; i < actualEnd; i++) {
    const sb = numericSeq[i >> 1]!
    const nibble = (sb >> ((1 - (i & 1)) << 2)) & 0xf
    result += SEQRET_STRING_DECODER[nibble]!
  }
  return result
}

function cigarToMismatchesNumeric(
  ops: ArrayLike<number>,
  numericSeq: ArrayLike<number>,
  seqLength: number,
  ref?: string,
  qual?: ArrayLike<number> | null,
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
  ops: ArrayLike<number>,
  mismatches: Mismatch[],
  numericSeq: ArrayLike<number>,
  seqLength: number,
  hasSkips: boolean,
  qual?: ArrayLike<number> | null,
) {
  const opsLength = ops.length
  const hasQual = !!qual
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

/**
 * Parse MD tag directly from bytes (ArrayLike<number>).
 * Same logic as mdToMismatchesNumeric but avoids string conversion.
 */
function mdToMismatchesFromBytes(
  md: ArrayLike<number>,
  ops: ArrayLike<number>,
  mismatches: Mismatch[],
  numericSeq: ArrayLike<number>,
  seqLength: number,
  hasSkips: boolean,
  qual?: ArrayLike<number> | null,
) {
  const mdLength = md.length
  const opsLength = ops.length
  const hasQual = !!qual
  const cigarLength = mismatches.length

  let currStart = 0
  let lastCigar = 0
  let lastTemplateOffset = 0
  let lastRefOffset = 0
  let lastSkipPos = 0

  let i = 0
  while (i < mdLength) {
    const char = md[i]!

    if (char >= 48 && char <= 57) {
      // digit (0-9)
      let num = 0
      while (i < mdLength) {
        const c = md[i]!
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
      while (i < mdLength && md[i]! >= 65) {
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
