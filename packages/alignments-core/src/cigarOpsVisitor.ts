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
 * Walks pre-parsed (packed int) CIGAR ops in bp-space and fires a callback
 * for each rendered segment. Small indels (len < bpPerPx) are merged into
 * surrounding context; tiny M segments (both accumulators advance < bpPerPx)
 * are accumulated before emitting.
 *
 * Used by synteny and dotplot GPU renderers so both stay in sync.
 * Re-exported via @jbrowse/synteny-core for consistent import paths.
 *
 * Callback receives bp-space segment boundaries (cumBp, no inter-region
 * padding). Callers convert to screen positions with hp-math.
 */
export function visitCigarRenderedSegments(
  cigar: number[],
  startBp1: number,
  startBp2: number,
  bpPerPx0: number,
  bpPerPx1: number,
  rev1: number,
  rev2: number,
  callback: (
    op: number,
    segBp1Start: number,
    segBp1End: number,
    segBp2Start: number,
    segBp2End: number,
  ) => void,
): void {
  let continuingFlag = false
  let segBp1Start = startBp1
  let segBp2Start = startBp2
  let bp1 = startBp1
  let bp2 = startBp2

  for (let j = 0; j < cigar.length; j++) {
    const packed = cigar[j]!
    const len = packed >>> 4
    const op = packed & 0xf

    if (!continuingFlag) {
      segBp1Start = bp1
      segBp2Start = bp2
    }

    if (op === CIGAR_M || op === CIGAR_EQ || op === CIGAR_X) {
      bp1 += len * rev1
      bp2 += len * rev2
    } else if (op === CIGAR_D || op === CIGAR_N) {
      bp1 += len * rev1
    } else if (op === CIGAR_I) {
      bp2 += len * rev2
    }

    if (op === CIGAR_D || op === CIGAR_N || op === CIGAR_I) {
      const relevantBpPerPx = op === CIGAR_I ? bpPerPx1 : bpPerPx0
      if (len < relevantBpPerPx) {
        continuingFlag = true
        continue
      }
    }

    const isNotLast = j < cigar.length - 1
    if (
      Math.abs(bp1 - segBp1Start) <= bpPerPx0 &&
      Math.abs(bp2 - segBp2Start) <= bpPerPx1 &&
      isNotLast
    ) {
      continuingFlag = true
    } else {
      const span1 = Math.abs(bp1 - segBp1Start)
      const span2 = Math.abs(bp2 - segBp2Start)
      const resolvedOp = span1 > bpPerPx0 || span2 > bpPerPx1 ? op : CIGAR_M
      continuingFlag = false
      callback(resolvedOp, segBp1Start, bp1, segBp2Start, bp2)
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
