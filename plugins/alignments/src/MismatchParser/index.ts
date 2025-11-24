import { cigarToMismatches } from './cigarToMismatches'
import { cigarToMismatches2 } from './cigarToMismatches2'
import { mdToMismatches } from './mdToMismatches'
import { mdToMismatches2 } from './mdToMismatches2'

import type { Mismatch } from '../shared/types'
import type { Feature } from '@jbrowse/core/util'

const startClip = new RegExp(/(\d+)[SH]$/)
const endClip = new RegExp(/^(\d+)([SH])/)

// CIGAR operation char codes for parseCigar2
export const CIGAR_M = 77 // 'M'
export const CIGAR_I = 73 // 'I'
export const CIGAR_D = 68 // 'D'
export const CIGAR_N = 78 // 'N'
export const CIGAR_S = 83 // 'S'
export const CIGAR_H = 72 // 'H'
export const CIGAR_X = 88 // 'X'
export const CIGAR_P = 80 // 'P'
export const CIGAR_E = 69 // 'E'
export const CIGAR_EQ = 61 // '='

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

// Optimized version: returns all numbers [length1, opCode1, length2, opCode2, ...]
// where opCode is the char code (M=77, I=73, etc)
// Use CIGAR_OP constants for comparison
export function parseCigar2(s = '') {
  let currLen = 0
  const ret = []
  for (let i = 0, l = s.length; i < l; i++) {
    const code = s.charCodeAt(i)
    if (code >= 48 && code <= 57) {
      // '0' to '9'
      currLen = currLen * 10 + (code - 48)
    } else {
      ret.push(currLen, code)
      currLen = 0
    }
  }
  return ret
}

export function getMismatches(
  cigar?: string,
  md?: string,
  seq?: string,
  ref?: string,
  qual?: Uint8Array,
) {
  let mismatches: Mismatch[] = []
  const ops = parseCigar(cigar)
  // parse the CIGAR tag if it has one
  if (cigar) {
    mismatches = mismatches.concat(cigarToMismatches(ops, seq, ref, qual))
  }

  // now let's look for CRAM or MD mismatches
  if (md && seq) {
    mismatches = mismatches.concat(
      mdToMismatches(md, ops, mismatches, seq, qual),
    )
  }

  return mismatches
}

// Optimized version using packed NUMERIC_CIGAR from @gmod/bam
export function getMismatches2(
  cigar?: Uint32Array,
  md?: string,
  seq?: string,
  ref?: string,
  qual?: Uint8Array,
) {
  let mismatches: Mismatch[] = []
  // parse the CIGAR tag if it has one
  if (cigar && cigar.length > 0) {
    mismatches = mismatches.concat(cigarToMismatches2(cigar, seq, ref, qual))
  }

  // now let's look for CRAM or MD mismatches
  if (md && seq && cigar) {
    mismatches = mismatches.concat(
      mdToMismatches2(md, cigar, mismatches, seq, qual),
    )
  }

  return mismatches
}

export function getOrientedCigar(flip: boolean, cigar: string[]) {
  if (flip) {
    const ret = []
    for (let i = 0; i < cigar.length; i += 2) {
      const len = cigar[i]!
      let op = cigar[i + 1]!
      if (op === 'D') {
        op = 'I'
      } else if (op === 'I') {
        op = 'D'
      }
      ret.push(len, op)
    }
    return ret
  }
  return cigar
}

export function getOrientedMismatches(flip: boolean, cigar: string) {
  const p = parseCigar(cigar)
  return cigarToMismatches(flip ? getOrientedCigar(flip, p) : p)
}

export function getLengthOnRef(cigar: string) {
  const cigarOps = parseCigar(cigar)
  let lengthOnRef = 0
  for (let i = 0; i < cigarOps.length; i += 2) {
    const len = +cigarOps[i]!
    const op = cigarOps[i + 1]
    if (op !== 'H' && op !== 'S' && op !== 'I') {
      lengthOnRef += len
    }
  }
  return lengthOnRef
}

export function getLength(cigar: string) {
  const cigarOps = parseCigar(cigar)
  let length = 0
  for (let i = 0; i < cigarOps.length; i += 2) {
    const len = +cigarOps[i]!
    const op = cigarOps[i + 1]
    if (op !== 'D' && op !== 'N') {
      length += len
    }
  }
  return length
}

export function getLengthSansClipping(cigar: string) {
  const cigarOps = parseCigar(cigar)
  let length = 0
  for (let i = 0; i < cigarOps.length; i += 2) {
    const len = +cigarOps[i]!
    const op = cigarOps[i + 1]
    if (op !== 'H' && op !== 'S' && op !== 'D' && op !== 'N') {
      length += len
    }
  }
  return length
}

export function getClip(cigar: string, strand: number) {
  return strand === -1
    ? +(startClip.exec(cigar) || [])[1]! || 0
    : +(endClip.exec(cigar) || [])[1]! || 0
}

export function getTag(feature: Feature, tag: string) {
  return feature.get('tags')[tag]
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
          clipPos: saClipPos,
          CIGAR: saCigar,
          strand: (normalize ? strand : 1) * saStrandNormalized,
          uniqueId: `${id}_SA${index}`,
          mate: {
            start: saClipPos,
            end: saClipPos + saLengthSansClipping,
            refName: readName,
          },
        }
      }) || []
  )
}

export { getNextRefPos } from './getNextRefPos'
export { cigarToMismatches2 } from './cigarToMismatches2'
