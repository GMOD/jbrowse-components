import { DASH, isGapByte } from '@jbrowse/core/util/alignedBytes'

import type { MafBlock } from '../mafRenderingBackendTypes.ts'

/**
 * Whether any row of this block *could* carry an insertion — i.e. whether the
 * block has a reference-gap column at all.
 *
 * Free, and it answers for every row at once: a block's `endBp` is `startBp`
 * plus its count of non-gap reference bytes (the worker's own definition), so
 * the two agreeing with the column count means the reference has no `-` in it,
 * and an insertion can only sit inside a reference-gap run. Most blocks
 * of a real MAF have none, so the insertion walk skips them without visiting a
 * row.
 */
export function blockHasRefGap(block: MafBlock) {
  return block.endBp - block.startBp !== block.refSeqBytes.length
}

/**
 * A block's reference-gap runs as `[startCol, endCol, anchorOffset]` triples,
 * `anchorOffset` being the reference bases before the run, so every row of the
 * block can visit only these columns.
 */
export function refGapRuns(refBytes: Uint8Array) {
  const runs: number[] = []
  let refCount = 0
  let i = 0
  while (i < refBytes.length) {
    if (refBytes[i] === DASH) {
      const start = i
      while (i < refBytes.length && refBytes[i] === DASH) {
        i++
      }
      runs.push(start, i, refCount)
    } else {
      refCount++
      i++
    }
  }
  return runs
}

/**
 * `forEachInsertion`'s `anchorBp` and `length` over a block's `refGapRuns`,
 * visiting only the gap columns.
 */
export function forEachInsertionLength(
  runs: readonly number[],
  alnBytes: Uint8Array,
  startBp: number,
  cb: (anchorBp: number, length: number) => void,
) {
  for (let k = 0; k < runs.length; k += 3) {
    const end = Math.min(runs[k + 1]!, alnBytes.length)
    let length = 0
    for (let i = runs[k]!; i < end; i++) {
      if (!isGapByte(alnBytes[i]!)) {
        length++
      }
    }
    if (length > 0) {
      cb(startBp + runs[k + 2]!, length)
    }
  }
}

/**
 * Walk a single aligned row against the reference and emit one callback per
 * insertion (a run of reference-gap columns where this sample carries bases).
 * The hover reads it; the painters read `forEachInsertionLength`, which a test
 * holds to the same anchors and lengths.
 *
 * - `anchorBp`: absolute genomic coord the marker sits before (the next
 *   reference base after the run).
 * - `length`: number of inserted (non-gap) bases in this sample.
 * - `baseOffset`: count of this sample's non-gap bases before the run (its own
 *   coordinate of the first inserted base, via the row's `srcStart`/strand).
 * - `[byteStart, byteEnd)`: span of the run in `alnBytes`, for callers that
 *   need the inserted sequence (gaps within the span are skipped).
 */
export function forEachInsertion(
  refBytes: Uint8Array,
  alnBytes: Uint8Array,
  startBp: number,
  cb: (
    anchorBp: number,
    length: number,
    baseOffset: number,
    byteStart: number,
    byteEnd: number,
  ) => void,
) {
  const len = Math.min(refBytes.length, alnBytes.length)
  let refCount = 0
  let baseOffset = 0
  let i = 0
  while (i < len) {
    if (refBytes[i] === DASH) {
      const anchorBp = startBp + refCount
      const runBaseStart = baseOffset
      const byteStart = i
      let length = 0
      while (i < len && refBytes[i] === DASH) {
        if (!isGapByte(alnBytes[i]!)) {
          length++
          baseOffset++
        }
        i++
      }
      if (length > 0) {
        cb(anchorBp, length, runBaseStart, byteStart, i)
      }
    } else {
      if (!isGapByte(alnBytes[i]!)) {
        baseOffset++
      }
      refCount++
      i++
    }
  }
}
