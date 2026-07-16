import {
  CIGAR_D,
  CIGAR_H,
  CIGAR_I,
  CIGAR_N,
  CIGAR_S,
} from './cigarConstants.ts'
import { cigarToMismatches2 } from './cigarToMismatches2.ts'
import { mdToMismatches2 } from './mdToMismatches2.ts'

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

/**
 * #api
 * Parses a CIGAR string to an alternating `[length, op, ...]` string array.
 */
export function parseCigar(s = '') {
  let currLen = ''
  const ret: string[] = []
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

/**
 * #api
 * Parses a CIGAR string to a packed number array where each value is
 * `(length << 4) | opIndex`.
 */
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

/**
 * #api
 * Same encoding as `parseCigar2` but writes into a packed `Uint32Array` —
 * matches the NUMERIC_CIGAR format that BAM/CRAM adapters emit, so consumers can
 * use a single typed-array code path.
 */
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

/**
 * #api
 * Computes the list of mismatches (SNVs, indels, clips, skips) for a read from
 * its CIGAR, optional MD tag, sequence, reference, and quality.
 */
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

// All three lengths in one pass over already-parsed ops: callers that want more
// than one (featurizeSA wants all three) would otherwise re-scan and re-allocate
// the op array per length.
function cigarLengths(ops: ArrayLike<number>) {
  let lengthOnRef = 0
  let length = 0
  let lengthSansClipping = 0
  for (let i = 0, l = ops.length; i < l; i++) {
    const op = ops[i]!
    const opIdx = op & 0xf
    const len = op >>> 4
    const clipping = opIdx === CIGAR_H || opIdx === CIGAR_S
    const refOnly = opIdx === CIGAR_D || opIdx === CIGAR_N
    if (!clipping && opIdx !== CIGAR_I) {
      lengthOnRef += len
    }
    if (!refOnly) {
      length += len
    }
    if (!clipping && !refOnly) {
      lengthSansClipping += len
    }
  }
  return { lengthOnRef, length, lengthSansClipping }
}

/**
 * #api
 * Length the read spans on the reference (sum of M/=/X/D/N ops).
 */
export function getLengthOnRef(cigar: string) {
  return cigarLengths(parseCigar2(cigar)).lengthOnRef
}

/**
 * #api
 * Length of the read sequence (sum of all ops except D/N).
 */
export function getLength(cigar: string) {
  return cigarLengths(parseCigar2(cigar)).length
}

export function getLengthSansClipping(cigar: string) {
  return cigarLengths(parseCigar2(cigar)).lengthSansClipping
}

// clip at the end of the CIGAR string = start of a reverse-strand read,
// clip at the start of the CIGAR string = start of a forward-strand read
export function getClip(cigar: string, strand: number) {
  if (!cigar) {
    return 0
  }
  if (strand === -1) {
    const last = cigar.length - 1
    const op = cigar[last]
    if (op === 'S' || op === 'H') {
      let i = last
      while (i > 0 && cigar[i - 1]! >= '0' && cigar[i - 1]! <= '9') {
        i--
      }
      return +cigar.slice(i, last)
    }
    return 0
  } else {
    let i = 0
    while (cigar[i]! >= '0' && cigar[i]! <= '9') {
      i++
    }
    const op = cigar[i]
    return (op === 'S' || op === 'H') && i > 0 ? +cigar.slice(0, i) : 0
  }
}

// numeric analog of getClip: reads the start-clip length straight off a packed
// NUMERIC_CIGAR (each entry = (length << 4) | opIndex) without serializing to a
// CIGAR string. Reverse-strand reads clip at the CIGAR tail, forward at the head.
export function clipLengthAtStartOfReadNumeric(
  cigar: ArrayLike<number>,
  strand: number,
) {
  const len = cigar.length
  if (len === 0) {
    return 0
  }
  const packed = strand === -1 ? cigar[len - 1]! : cigar[0]!
  const op = packed & 0xf
  return op === CIGAR_S || op === CIGAR_H ? packed >> 4 : 0
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
  strand: number | undefined,
  readName: string | undefined,
  normalize?: boolean,
) {
  return SA === undefined
    ? []
    : featurizeSAEntries(splitSA(SA), id, strand, readName, normalize)
}

/**
 * #api
 * The `;`-separated alignment records of an SA tag, empties dropped — the input
 * `featurizeSAEntries` expects.
 */
export function splitSA(SA: string) {
  return SA.split(';').filter(aln => !!aln)
}

/**
 * #api
 * featurizeSA over pre-split entries (see splitSA). Lets a caller filter the
 * entries first — e.g. deduplicating the records repeated across a split read's
 * segments — without paying to split and rejoin the tag around the filter.
 */
export function featurizeSAEntries(
  entries: string[],
  id: string,
  strand: number | undefined,
  readName: string | undefined,
  normalize?: boolean,
) {
  const strandNum = strand ?? 1
  return entries.map((aln, index) => {
    const ret = aln.split(',')
    const saRef = ret[0]!
    const saStart = ret[1]!
    const saStrand = ret[2]!
    const saCigar = ret[3]!
    const saOps = parseCigar2(saCigar)
    const {
      lengthOnRef: saLengthOnRef,
      length: saLength,
      lengthSansClipping: saLengthSansClipping,
    } = cigarLengths(saOps)
    const saStrandNormalized: -1 | 1 = saStrand === '-' ? -1 : 1
    const effectiveStrand: -1 | 1 = normalize
      ? strandNum === saStrandNormalized
        ? 1
        : -1
      : saStrandNormalized
    const saClipPos = clipLengthAtStartOfReadNumeric(saOps, effectiveStrand)
    const saRealStart = +saStart - 1
    return {
      refName: saRef,
      start: saRealStart,
      end: saRealStart + saLengthOnRef,
      seqLength: saLength,
      clipLengthAtStartOfRead: saClipPos,
      CIGAR: saCigar,
      strand: effectiveStrand,
      uniqueId: `${id}_SA${index}`,
      mate: {
        start: saClipPos,
        end: saClipPos + saLengthSansClipping,
        refName: readName,
      },
    }
  })
}
