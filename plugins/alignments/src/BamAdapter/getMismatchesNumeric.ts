import {
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
  let hasSkips = false

  soa = cigarToMismatchesSOA(cigar, numericSeq, seqLength, soa, ref, qual)

  // Check if we have any skips
  for (let i = 0; i < soa.count; i++) {
    if (soa.types[i] === TYPE_SKIP) {
      hasSkips = true
      break
    }
  }

  // Parse MD tag if available
  if (md) {
    soa = mdToMismatchesSOA(
      md,
      cigar,
      soa,
      numericSeq,
      seqLength,
      hasSkips,
      qual,
    )
  }

  return trimMismatchesSOA(soa)
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
    result += String.fromCharCode(SEQRET_CHARCODE_DECODER[nibble]!)
  }
  return result
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
      // insertion: length=insertion length, '+' = 43 as placeholder char
      soa = pushMismatch(
        soa,
        roffset,
        len,
        TYPE_INSERTION,
        43,
        0,
        0,
        insertedBases,
      )
      soffset += len
    } else if (op === CIGAR_D) {
      // deletion: length=deletion length, '*' = 42
      soa = pushMismatch(soa, roffset, len, TYPE_DELETION, 42, 0, 0)
      roffset += len
    } else if (op === CIGAR_N) {
      // skip: length=skip length, 'N' = 78
      soa = pushMismatch(soa, roffset, len, TYPE_SKIP, 78, 0, 0)
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
      // hardclip: length=clip length, 'H' = 72
      soa = pushMismatch(soa, roffset, len, TYPE_HARDCLIP, 72, 0, 0)
    } else if (op === CIGAR_S) {
      // softclip: length=clip length, 'S' = 83
      soa = pushMismatch(soa, roffset, len, TYPE_SOFTCLIP, 83, 0, 0)
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
  hasSkips: boolean,
  qual?: Uint8Array,
): MismatchesSOA {
  const opsLength = ops.length
  const hasQual = qual !== undefined
  const cigarCount = soa.count

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
        baseCharCode = 88 // 'X'
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
