import {
  CIGAR_D,
  CIGAR_EQ,
  CIGAR_I,
  CIGAR_M,
  CIGAR_N,
  CIGAR_S,
  CIGAR_X,
} from './cigarConstants.ts'

const ALIGNED = (1 << CIGAR_M) | (1 << CIGAR_EQ) | (1 << CIGAR_X)
const CONSUMES_READ = ALIGNED | (1 << CIGAR_I) | (1 << CIGAR_S)
const CONSUMES_REF = ALIGNED | (1 << CIGAR_D) | (1 << CIGAR_N)

export interface CigarCursor {
  op: number
  opRead: number
  opRef: number
}

export interface ReadWindow extends CigarCursor {
  readStart: number
  readEnd: number
  refStart: number
  refEnd: number
}

/**
 * #api
 * The read offsets `[readStart, readEnd)` holding every aligned base whose
 * read-relative reference offset lies in `[refStart, refEnd)`, and the op a
 * `getNextRefPos` walk over them starts at. Aligned read offsets map to
 * ascending reference offsets, so the range holds no other aligned base; a
 * clip or insertion inside it maps to no reference offset. The returned
 * `refStart`/`refEnd` are the requested ones clipped to the read's span.
 *
 * The op loop adds each op's lengths through the masks above rather than
 * branching on the op, because a long read's op sequence is close to random
 * and the branches mispredict; only the op that crosses the next edge takes
 * the slow path.
 */
export function refWindowToRead(
  cigarOps: ArrayLike<number>,
  refStart: number,
  refEnd: number,
): ReadWindow {
  let readPos = 0
  let refPos = 0
  let readStart = -1
  let readEnd = -1
  let op = cigarOps.length
  let opRead = 0
  let opRef = 0
  let edge = Math.min(refStart + 1, refEnd)
  for (let i = 0, l = cigarOps.length; i < l; i++) {
    const packed = cigarOps[i]!
    const len = packed >>> 4
    const code = packed & 0xf
    const refLen = len & -((CONSUMES_REF >>> code) & 1)
    if (refPos + refLen >= edge) {
      const aligned = (ALIGNED >>> code) & 1
      if (readStart < 0 && aligned) {
        readStart = readPos + Math.max(0, refStart - refPos)
        op = i
        opRead = readPos
        opRef = refPos
        edge = refEnd
      }
      if (refPos + refLen >= refEnd) {
        readEnd = aligned ? readPos + Math.max(0, refEnd - refPos) : readPos
        refPos += refLen
        break
      }
    }
    readPos += len & -((CONSUMES_READ >>> code) & 1)
    refPos += refLen
  }
  if (readEnd < 0) {
    readEnd = readPos
  }
  if (readStart < 0 || readStart > readEnd) {
    readStart = readEnd
  }
  const clippedStart = Math.max(0, refStart)
  return {
    readStart,
    readEnd,
    refStart: clippedStart,
    refEnd: Math.max(clippedStart, Math.min(refEnd, refPos)),
    op,
    opRead,
    opRef,
  }
}
