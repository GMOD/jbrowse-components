import {
  CIGAR_D,
  CIGAR_EQ,
  CIGAR_I,
  CIGAR_M,
  CIGAR_N,
  CIGAR_X,
} from './cigarConstants.ts'
import { isCsOpChar, isDigit } from './labelConstants.ts'

export interface CigarOpsVisitor {
  onMismatch(refPos: number, len: number, queryBase?: string): void
  onDeletion(refPos: number, len: number): void
  onInsertion(refPos: number, len: number, insertionSeq?: string): void
}

export function visitCigarOps(
  cigar: number[],
  featStart: number,
  visitor: CigarOpsVisitor,
) {
  let refPos = 0
  for (const packed of cigar) {
    const len = packed >>> 4
    const op = packed & 0xf

    if (op === CIGAR_M || op === CIGAR_EQ) {
      refPos += len
    } else if (op === CIGAR_X) {
      visitor.onMismatch(featStart + refPos, len)
      refPos += len
    } else if (op === CIGAR_D || op === CIGAR_N) {
      visitor.onDeletion(featStart + refPos, len)
      refPos += len
    } else if (op === CIGAR_I) {
      visitor.onInsertion(featStart + refPos, len)
    }
  }
}

export function visitCsOps(
  cs: string,
  featStart: number,
  visitor: CigarOpsVisitor,
) {
  let refPos = 0
  let i = 0

  while (i < cs.length) {
    const ch = cs[i]!

    if (ch === ':') {
      i++
      let num = 0
      while (i < cs.length && isDigit(cs[i]!)) {
        num = num * 10 + (cs.charCodeAt(i) - 48)
        i++
      }
      refPos += num
    } else if (ch === '*') {
      const queryBase = cs[i + 2] ?? ''
      visitor.onMismatch(featStart + refPos, 1, queryBase)
      i += 3
      refPos += 1
    } else if (ch === '-') {
      i++
      const seqStart = i
      while (i < cs.length && !isCsOpChar(cs[i])) {
        i++
      }
      const len = i - seqStart
      if (len > 0) {
        visitor.onDeletion(featStart + refPos, len)
        refPos += len
      }
    } else if (ch === '+') {
      i++
      const seqStart = i
      while (i < cs.length && !isCsOpChar(cs[i])) {
        i++
      }
      const len = i - seqStart
      if (len > 0) {
        visitor.onInsertion(
          featStart + refPos,
          len,
          cs.slice(seqStart, seqStart + len).toUpperCase(),
        )
      }
    } else {
      i++
    }
  }
}
