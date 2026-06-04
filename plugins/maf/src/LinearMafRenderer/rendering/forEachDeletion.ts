import { DASH } from '../../util/asciiBytes.ts'

/**
 * Walk a single aligned row against the reference and emit one callback per
 * deletion: a run of reference-base columns where this sample carries an
 * alignment gap (`-`). Single source of truth for MAF's deletion geometry —
 * used by rendering (the bp-count overlay + Canvas2D export) and the hover
 * hit-test, so they can't disagree. Mirrors `forEachInsertion`.
 *
 * Only `-` counts as a deletion; a space (`SPACE`) is missing data, not an
 * alignment gap, so it does not start or extend a deletion run. Reference-gap
 * columns (insertion columns) consume no reference coordinate and break a run.
 *
 * - `startBp`: absolute genomic coord of the first deleted reference base.
 * - `length`: number of reference bases deleted in this run.
 */
export function forEachDeletion(
  refBytes: Uint8Array,
  alnBytes: Uint8Array,
  startBp: number,
  cb: (startBp: number, length: number) => void,
) {
  const len = Math.min(refBytes.length, alnBytes.length)
  let refCount = 0
  let i = 0
  while (i < len) {
    if (refBytes[i] !== DASH && alnBytes[i] === DASH) {
      const delStart = startBp + refCount
      let length = 0
      while (i < len && refBytes[i] !== DASH && alnBytes[i] === DASH) {
        length++
        refCount++
        i++
      }
      cb(delStart, length)
    } else {
      if (refBytes[i] !== DASH) {
        refCount++
      }
      i++
    }
  }
}
