import {
  CIGAR_D,
  CIGAR_H,
  CIGAR_I,
  CIGAR_N,
  CIGAR_S,
} from './cigarConstants.ts'
import { cigarToMismatches2 } from './cigarToMismatches2.ts'
import { mdToMismatches2 } from './mdToMismatches2.ts'

const startClip = new RegExp(/(\d+)[SH]$/)
const endClip = new RegExp(/^(\d+)([SH])/)

// Parses a CIGAR string to alternating [length, op] tokens, e.g.
// '5M3I2D' → ['5','M','3','I','2','D']
export function parseCigar(s = '') {
  let currLen = ''
  const ret = []
  for (let i = 0, l = s.length; i < l; i++) {
    const c = s[i]!
    if (c >= '0' && c <= '9') {
      currLen = currLen + c
    } else {
      ret.push(currLen, c)
      currLen = ''
    }
  }
  return ret
}

// CIGAR operation char codes to indices (from BAM spec)
const CIGAR_CODE_TO_INDEX: Record<number, number> = {
  77: 0, // M
  73: 1, // I
  68: 2, // D
  78: 3, // N
  83: 4, // S
  72: 5, // H
  80: 6, // P
  61: 7, // =
  88: 8, // X
}

// Parses CIGAR string to packed number array where each value is (length << 4) | opIndex
export function parseCigar2(s = '') {
  let currLen = 0
  const ret: number[] = []
  for (let i = 0, l = s.length; i < l; i++) {
    const code = s.charCodeAt(i)
    if (code >= 48 && code <= 57) {
      currLen = currLen * 10 + (code - 48)
    } else {
      const opIndex = CIGAR_CODE_TO_INDEX[code]!
      ret.push((currLen << 4) | opIndex)
      currLen = 0
    }
  }
  return ret
}

// Same encoding as parseCigar2 but writes into a packed Uint32Array — matches
// the NUMERIC_CIGAR format that BAM/CRAM adapters emit, so consumers can use a
// single typed-array code path. Two-pass: count ops, then alloc and fill.
export function parseCigar2Typed(s = '') {
  let opCount = 0
  for (let i = 0, l = s.length; i < l; i++) {
    const code = s.charCodeAt(i)
    if (code < 48 || code > 57) {
      opCount++
    }
  }
  const out = new Uint32Array(opCount)
  let currLen = 0
  let j = 0
  for (let i = 0, l = s.length; i < l; i++) {
    const code = s.charCodeAt(i)
    if (code >= 48 && code <= 57) {
      currLen = currLen * 10 + (code - 48)
    } else {
      out[j++] = (currLen << 4) | CIGAR_CODE_TO_INDEX[code]!
      currLen = 0
    }
  }
  return out
}

export function getMismatches(
  cigar?: string,
  md?: string,
  seq?: string,
  ref?: string,
  qual?: Uint8Array,
) {
  const ops = parseCigar2(cigar)
  const mismatches = cigar ? cigarToMismatches2(ops, seq, ref, qual) : []
  if (md && seq) {
    return mismatches.concat(mdToMismatches2(md, ops, mismatches, seq, qual))
  }
  return mismatches
}

export function getLengthOnRef(cigar: string) {
  const cigarOps = parseCigar2(cigar)
  let lengthOnRef = 0
  for (const op of cigarOps) {
    const opIdx = op & 0xf
    if (opIdx !== CIGAR_H && opIdx !== CIGAR_S && opIdx !== CIGAR_I) {
      lengthOnRef += op >>> 4
    }
  }
  return lengthOnRef
}

export function getLength(cigar: string) {
  const cigarOps = parseCigar2(cigar)
  let length = 0
  for (const op of cigarOps) {
    const opIdx = op & 0xf
    if (opIdx !== CIGAR_D && opIdx !== CIGAR_N) {
      length += op >>> 4
    }
  }
  return length
}

export function getLengthSansClipping(cigar: string) {
  const cigarOps = parseCigar2(cigar)
  let length = 0
  for (const op of cigarOps) {
    const opIdx = op & 0xf
    if (
      opIdx !== CIGAR_H &&
      opIdx !== CIGAR_S &&
      opIdx !== CIGAR_D &&
      opIdx !== CIGAR_N
    ) {
      length += op >>> 4
    }
  }
  return length
}

export function getClip(cigar: string, strand: number) {
  return strand === -1
    ? +(startClip.exec(cigar) ?? [])[1]! || 0
    : +(endClip.exec(cigar) ?? [])[1]! || 0
}

// produces a list of "feature-like" object from parsing supplementary
// alignments in the SA tag
//
// @param normalize - used specifically in the linear-read-vs-ref context, it
// flips features around relative to the original feature. other contexts of
// usage can keep this false
export function featurizeSA(
  SA: string | undefined,
  id: string,
  strand: number,
  readName: string,
  normalize?: boolean,
) {
  return (
    SA?.split(';')
      .filter(aln => !!aln)
      .map((aln, index) => {
        const ret = aln.split(',')
        const saRef = ret[0]!
        const saStart = ret[1]!
        const saStrand = ret[2]!
        const saCigar = ret[3]!
        const saLengthOnRef = getLengthOnRef(saCigar)
        const saLength = getLength(saCigar)
        const saLengthSansClipping = getLengthSansClipping(saCigar)
        const saStrandNormalized = saStrand === '-' ? -1 : 1
        const saClipPos = getClip(
          saCigar,
          (normalize ? strand : 1) * saStrandNormalized,
        )
        const saRealStart = +saStart - 1
        return {
          refName: saRef,
          start: saRealStart,
          end: saRealStart + saLengthOnRef,
          seqLength: saLength,
          clipLengthAtStartOfRead: saClipPos,
          CIGAR: saCigar,
          strand: (normalize ? strand : 1) * saStrandNormalized,
          uniqueId: `${id}_SA${index}`,
          mate: {
            start: saClipPos,
            end: saClipPos + saLengthSansClipping,
            refName: readName,
          },
        }
      }) ?? []
  )
}

export { getNextRefPos } from './getNextRefPos.ts'
export { cigarToMismatches2 } from './cigarToMismatches2.ts'
