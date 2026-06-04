import { DASH, SPACE } from '../../util/asciiBytes.ts'

/**
 * Walk a single aligned row against the reference and emit one callback per
 * insertion (a run of reference-gap columns where this sample carries bases).
 * Single source of truth for MAF's insertion geometry — used by rendering (the
 * on-screen overlay + Canvas2D export) and the hover hit-test, so they can't
 * disagree on where insertions are or how long they are.
 *
 * - `anchorBp`: absolute genomic coord the marker sits before (the next
 *   reference base after the run).
 * - `length`: number of inserted (non-gap) bases in this sample.
 * - `baseOffset`: count of this sample's non-gap bases before the run (its own
 *   coordinate of the first inserted base, via the row's start/strand).
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
        const code = alnBytes[i]!
        if (code !== DASH && code !== SPACE) {
          length++
          baseOffset++
        }
        i++
      }
      if (length > 0) {
        cb(anchorBp, length, runBaseStart, byteStart, i)
      }
    } else {
      const code = alnBytes[i]!
      if (code !== DASH && code !== SPACE) {
        baseOffset++
      }
      refCount++
      i++
    }
  }
}
