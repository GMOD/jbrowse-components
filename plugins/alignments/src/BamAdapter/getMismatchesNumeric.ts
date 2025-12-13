import {
  CHAR_H,
  CHAR_N,
  CHAR_PLUS,
  CHAR_S,
  CHAR_STAR,
  CHAR_X,
  TYPE_DELETION,
  TYPE_HARDCLIP,
  TYPE_INSERTION,
  TYPE_MISMATCH,
  TYPE_SKIP,
  TYPE_SOFTCLIP,
  createMismatchesSOA,
  pushMismatch,
  trimMismatchesSOA,
} from '../shared/MismatchesSOA'

import type { MismatchesSOA } from '../shared/MismatchesSOA'

// CIGAR operation indices (from BAM spec)
const CIGAR_M = 0
const CIGAR_I = 1
const CIGAR_D = 2
const CIGAR_N = 3
const CIGAR_S = 4
const CIGAR_H = 5
const CIGAR_EQ = 7
const CIGAR_X = 8

// Sequence decoder for base char codes
// A=65, C=67, G=71, T=84, N=78, etc.
const SEQRET_CHARCODE_DECODER = new Uint8Array([
  61, 65, 67, 77, 71, 82, 83, 86, 84, 87, 89, 72, 75, 68, 66, 78,
])

// Lowercase for comparison: a=97, c=99, g=103, t=116
const SEQRET_LOWERCASE_DECODER = new Uint8Array([
  61, 97, 99, 109, 103, 114, 115, 118, 116, 119, 121, 104, 107, 100, 98, 110,
])

// Optimized getMismatches that works directly with NUMERIC_SEQ, NUMERIC_CIGAR, and NUMERIC_MD
// Returns struct-of-arrays format for better memory efficiency
export function getMismatchesNumeric(
  cigar: Uint32Array,
  numericSeq: Uint8Array,
  seqLength: number,
  md?: Uint8Array,
  ref?: string,
  qual?: Uint8Array,
): MismatchesSOA {
  let soa = createMismatchesSOA(16)

  soa = cigarToMismatchesSOA(cigar, numericSeq, seqLength, soa, ref, qual)

  // Parse MD tag if available
  if (md) {
    soa = mdToMismatchesSOA(md, cigar, soa, numericSeq, seqLength, qual)
  }

  return trimMismatchesSOA(soa)
}

// Pre-computed string lookup for single bases (avoids String.fromCharCode)
const SEQ_BASE_STRINGS = [
  '=',
  'A',
  'C',
  'M',
  'G',
  'R',
  'S',
  'V',
  'T',
  'W',
  'Y',
  'H',
  'K',
  'D',
  'B',
  'N',
]

// Pre-computed 2-base strings for when start is even (both nibbles from same byte)
// Avoids string concatenation for ~50% of len=2 cases
const TWO_BASE_STRINGS_SAME_BYTE: string[] = new Array(256)
for (let b = 0; b < 256; b++) {
  const highNibble = (b >> 4) & 0xf
  const lowNibble = b & 0xf
  TWO_BASE_STRINGS_SAME_BYTE[b] = SEQ_BASE_STRINGS[highNibble]! + SEQ_BASE_STRINGS[lowNibble]!
}

// Helper to decode a single base at position
function decodeBase(numericSeq: Uint8Array, pos: number) {
  const sb = numericSeq[pos >> 1]!
  const nibble = (sb >> ((1 - (pos & 1)) << 2)) & 0xf
  return SEQ_BASE_STRINGS[nibble]!
}

// Helper to get sequence slice from NUMERIC_SEQ
// Optimized for small insertions (len 1-4) which are most common
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

  // Fast paths for len 1-4 cover ~99% of insertions
  if (len === 1) {
    return decodeBase(numericSeq, start)
  }
  if (len === 2) {
    // If start is even, both nibbles are in the same byte - single lookup!
    if ((start & 1) === 0) {
      return TWO_BASE_STRINGS_SAME_BYTE[numericSeq[start >> 1]!]!
    }
    return decodeBase(numericSeq, start) + decodeBase(numericSeq, start + 1)
  }
  if (len === 3) {
    return (
      decodeBase(numericSeq, start) +
      decodeBase(numericSeq, start + 1) +
      decodeBase(numericSeq, start + 2)
    )
  }
  if (len === 4) {
    return (
      decodeBase(numericSeq, start) +
      decodeBase(numericSeq, start + 1) +
      decodeBase(numericSeq, start + 2) +
      decodeBase(numericSeq, start + 3)
    )
  }

  // General case for longer insertions
  const codes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    const pos = start + i
    const sb = numericSeq[pos >> 1]!
    const nibble = (sb >> ((1 - (pos & 1)) << 2)) & 0xf
    codes[i] = SEQRET_CHARCODE_DECODER[nibble]!
  }
  return String.fromCharCode(...codes)
}

function cigarToMismatchesSOA(
  ops: Uint32Array,
  numericSeq: Uint8Array,
  seqLength: number,
  soa: MismatchesSOA,
  ref?: string,
  qual?: Uint8Array,
): MismatchesSOA {
  let roffset = 0
  let soffset = 0
  const hasRef = !!ref
  const hasQual = qual !== undefined

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
          const seqBaseCode = SEQRET_LOWERCASE_DECODER[nibble]!
          const refBaseCode = ref.charCodeAt(roffset + j) | 0x20
          if (seqBaseCode !== refBaseCode) {
            const baseCharCode = SEQRET_CHARCODE_DECODER[nibble]!
            const altbaseCharCode = ref.charCodeAt(roffset + j)
            // mismatch: length=1
            soa = pushMismatch(
              soa,
              roffset + j,
              1,
              TYPE_MISMATCH,
              baseCharCode,
              0,
              altbaseCharCode,
            )
          }
        }
      }
      soffset += len
      roffset += len
    } else if (op === CIGAR_I) {
      const insertedBases = getSeqSlice(
        numericSeq,
        soffset,
        soffset + len,
        seqLength,
      )
      // insertion: length=insertion length
      soa = pushMismatch(
        soa,
        roffset,
        len,
        TYPE_INSERTION,
        CHAR_PLUS,
        0,
        0,
        insertedBases,
      )
      soffset += len
    } else if (op === CIGAR_D) {
      // deletion: length=deletion length
      soa = pushMismatch(soa, roffset, len, TYPE_DELETION, CHAR_STAR, 0, 0)
      roffset += len
    } else if (op === CIGAR_N) {
      // skip: length=skip length
      soa = pushMismatch(soa, roffset, len, TYPE_SKIP, CHAR_N, 0, 0)
      soa.hasSkips = true
      roffset += len
    } else if (op === CIGAR_X) {
      for (let j = 0; j < len; j++) {
        const seqIdx = soffset + j
        const sb = numericSeq[seqIdx >> 1]!
        const nibble = (sb >> ((1 - (seqIdx & 1)) << 2)) & 0xf
        const baseCharCode = SEQRET_CHARCODE_DECODER[nibble]!
        const qualVal = hasQual ? qual[seqIdx]! : 0
        // mismatch: length=1
        soa = pushMismatch(
          soa,
          roffset + j,
          1,
          TYPE_MISMATCH,
          baseCharCode,
          qualVal,
          0,
        )
      }
      soffset += len
      roffset += len
    } else if (op === CIGAR_H) {
      // hardclip: length=clip length
      soa = pushMismatch(soa, roffset, len, TYPE_HARDCLIP, CHAR_H, 0, 0)
    } else if (op === CIGAR_S) {
      // softclip: length=clip length
      soa = pushMismatch(soa, roffset, len, TYPE_SOFTCLIP, CHAR_S, 0, 0)
      soffset += len
    }
  }

  return soa
}

function mdToMismatchesSOA(
  md: Uint8Array,
  ops: Uint32Array,
  soa: MismatchesSOA,
  numericSeq: Uint8Array,
  seqLength: number,
  qual?: Uint8Array,
): MismatchesSOA {
  const opsLength = ops.length
  const hasQual = qual !== undefined
  const cigarCount = soa.count
  const hasSkips = soa.hasSkips

  let currStart = 0
  let lastCigar = 0
  let lastTemplateOffset = 0
  let lastRefOffset = 0
  let lastSkipPos = 0

  // Parse MD bytes
  let i = 0
  const len = md.length
  while (i < len) {
    const char = md[i]!

    if (char >= 48 && char <= 57) {
      // digit (0-9)
      let num = 0
      while (i < len) {
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
      while (i < len && md[i]! >= 65) {
        i++
        currStart++
      }
    } else if (char >= 65) {
      // letter (mismatch)
      const altbaseCharCode = char
      i++

      // Handle skips
      if (hasSkips && cigarCount > 0) {
        for (let k = lastSkipPos; k < cigarCount; k++) {
          if (soa.types[k] === TYPE_SKIP && currStart >= soa.starts[k]!) {
            currStart += soa.lengths[k]!
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
        const opLen = packed >> 4
        const op = packed & 0xf

        if (op === CIGAR_S || op === CIGAR_I) {
          templateOffset += opLen
        } else if (op === CIGAR_D || op === 6 || op === CIGAR_N) {
          // D, P, N
          refOffset += opLen
        } else if (op !== CIGAR_H) {
          templateOffset += opLen
          refOffset += opLen
        }
      }
      lastTemplateOffset = templateOffset
      lastRefOffset = refOffset
      const s = templateOffset - (refOffset - currStart)

      let baseCharCode: number
      if (s < seqLength) {
        const sb = numericSeq[s >> 1]!
        const nibble = (sb >> ((1 - (s & 1)) << 2)) & 0xf
        baseCharCode = SEQRET_CHARCODE_DECODER[nibble]!
      } else {
        baseCharCode = CHAR_X
      }

      const qualVal = hasQual ? qual[s]! : 0
      // mismatch: length=1
      soa = pushMismatch(
        soa,
        currStart,
        1,
        TYPE_MISMATCH,
        baseCharCode,
        qualVal,
        altbaseCharCode,
      )

      currStart++
    } else {
      i++
    }
  }

  return soa
}
