import { cigarToMismatches } from './cigarToMismatches'
import { mdToMismatches } from './mdToMismatches'
import type { Mismatch } from '../shared/types'
import type { Feature } from '@jbrowse/core/util'
import type { Buffer } from 'buffer'

const cigarRegex = new RegExp(/([MIDNSHPX=])/)
const startClip = new RegExp(/(\d+)[SH]$/)
const endClip = new RegExp(/^(\d+)([SH])/)

export function parseCigar(cigar = '') {
  return cigar.split(cigarRegex).slice(0, -1)
}

export function getMismatches(
  cigar?: string,
  md?: string,
  seq?: string,
  ref?: string,
  qual?: Buffer,
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
