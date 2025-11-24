import { seqAt } from '../shared/decodeSeq'

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

// Sequence decoder matching @gmod/bam format
const SEQRET_DECODER = '=ACMGRSVTWYHKDBN'.split('')

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
  let mismatches: Mismatch[] = []

  // Parse CIGAR operations
  mismatches = mismatches.concat(
    cigarToMismatchesNumeric(cigar, numericSeq, seqLength, ref, qual),
  )

  // Parse MD tag if available
  if (md && ref) {
    mismatches = mismatches.concat(
      mdToMismatchesNumeric(md, cigar, mismatches, numericSeq, seqLength, qual),
    )
  }

  return mismatches
}

// Helper to get base from NUMERIC_SEQ at position
function getSeqBase(
  numericSeq: Uint8Array,
  idx: number,
  seqLength: number,
): string {
  if (idx < seqLength) {
    const byteIndex = idx >> 1
    const sb = numericSeq[byteIndex]!
    return idx % 2 === 0
      ? SEQRET_DECODER[(sb & 0xf0) >> 4]!
      : SEQRET_DECODER[sb & 0x0f]!
  }
  return 'X'
}

// Helper to get sequence slice from NUMERIC_SEQ
function getSeqSlice(
  numericSeq: Uint8Array,
  start: number,
  end: number,
  seqLength: number,
): string {
  const buf: string[] = []
  for (let i = start; i < end && i < seqLength; i++) {
    buf.push(getSeqBase(numericSeq, i, seqLength))
  }
  return buf.join('')
}

function cigarToMismatchesNumeric(
  ops: Uint32Array,
  numericSeq: Uint8Array,
  seqLength: number,
  ref?: string,
  qual?: Uint8Array,
): Mismatch[] {
  let roffset = 0
  let soffset = 0
  const mismatches: Mismatch[] = []
  const hasRef = !!ref

  for (const op_ of ops) {
    const packed = op_
    const len = packed >> 4
    const op = packed & 0xf

    if (op === CIGAR_M || op === CIGAR_EQ) {
      if (hasRef) {
        for (let j = 0; j < len; j++) {
          const seqBase = getSeqBase(numericSeq, soffset + j, seqLength)
          const refBase = ref[roffset + j]!
          if (
            (seqBase.charCodeAt(0) | 0x20) !==
            (refBase.charCodeAt(0) | 0x20)
          ) {
            mismatches.push({
              start: roffset + j,
              type: 'mismatch',
              base: seqBase,
              altbase: refBase,
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
      mismatches.push({
        start: roffset,
        type: 'skip',
        base: 'N',
        length: len,
      })
      roffset += len
    } else if (op === CIGAR_X) {
      for (let j = 0; j < len; j++) {
        const seqBase = getSeqBase(numericSeq, soffset + j, seqLength)
        mismatches.push({
          start: roffset + j,
          type: 'mismatch',
          base: seqBase,
          qual: qual?.[soffset + j],
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

function mdToMismatchesNumeric(
  mdstring: string,
  ops: Uint32Array,
  cigarMismatches: Mismatch[],
  numericSeq: Uint8Array,
  seqLength: number,
  qual?: Uint8Array,
): Mismatch[] {
  const mismatchRecords: Mismatch[] = []
  const opsLength = ops.length
  const hasQual = qual !== undefined

  // Check for skips
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
      const letter = mdstring[i]!
      i++

      // Handle skips
      if (hasSkips && cigarLength > 0) {
        for (let k = lastSkipPos; k < cigarLength; k++) {
          const mismatch = cigarMismatches[k]!
          if (mismatch.type === 'skip' && currStart >= mismatch.start) {
            currStart += mismatch.length
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

      const base = getSeqBase(numericSeq, s, seqLength)
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
