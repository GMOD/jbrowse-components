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

/**
 * Walks pre-parsed CIGAR ops and fires a callback for each pixel-level-resolved
 * segment. Small indels (< 1 px) are merged into surrounding context; tiny M
 * segments (both cursors advance < 1 px) are accumulated before emitting.
 * Used by the synteny trapezoid renderer (on-screen GPU path and Canvas2D/SVG
 * export) so both stay in sync without manual duplication.
 */
export function visitCigarRenderedSegments(
  cigar: number[],
  startCx1: number,
  startCx2: number,
  bpPerPxInv0: number,
  bpPerPxInv1: number,
  rev1: number,
  rev2: number,
  callback: (
    op: number,
    px1: number,
    cx1: number,
    px2: number,
    cx2: number,
  ) => void,
): void {
  let continuingFlag = false
  let px1 = 0
  let px2 = 0
  let cx1 = startCx1
  let cx2 = startCx2

  for (let j = 0; j < cigar.length; j++) {
    const packed = cigar[j]!
    const len = packed >>> 4
    const op = packed & 0xf

    if (!continuingFlag) {
      px1 = cx1
      px2 = cx2
    }

    const d1 = len * bpPerPxInv0
    const d2 = len * bpPerPxInv1

    if (op === CIGAR_M || op === CIGAR_EQ || op === CIGAR_X) {
      cx1 += d1 * rev1
      cx2 += d2 * rev2
    } else if (op === CIGAR_D || op === CIGAR_N) {
      cx1 += d1 * rev1
    } else if (op === CIGAR_I) {
      cx2 += d2 * rev2
    }

    if (op === CIGAR_D || op === CIGAR_N || op === CIGAR_I) {
      const relevantPx = op === CIGAR_I ? d2 : d1
      if (relevantPx < 1) {
        continuingFlag = true
        continue
      }
    }

    const isNotLast = j < cigar.length - 1
    if (Math.abs(cx1 - px1) <= 1 && Math.abs(cx2 - px2) <= 1 && isNotLast) {
      continuingFlag = true
    } else {
      const resolvedOp = (continuingFlag && d1 > 1) || d2 > 1 ? op : CIGAR_M
      continuingFlag = false
      callback(resolvedOp, px1, cx1, px2, cx2)
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
