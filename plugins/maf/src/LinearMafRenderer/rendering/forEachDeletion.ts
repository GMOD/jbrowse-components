import { DASH, SPACE } from '../../util/asciiBytes.ts'

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
 * **A run must be flanked by this sample's own sequence to be a deletion.** A
 * gap run reaching the first or last column of the row is truncated by the block
 * boundary, so its length measures where the MAF was chunked rather than
 * anything about the alignment: a whole-genome MAF cut on fixed reference
 * intervals turns one unalignable region into a gap run trailing off the end of
 * one block, some blocks the sample is absent from entirely, and a gap run
 * leading into a later block. Labelling the two fragments puts a spurious pair
 * of lengths on either side of the real event, which is how one 2985bp
 * non-alignment came to read as a "525" and a "460" in the E. coli
 * Minigraph-Cactus track. Deciding whether a boundary gap continues needs the
 * MAF `i` lines, surfaced as `context` where present but absent from anything
 * `hal2maf` emits without `mafAddIRows`; UCSC's wigMaf declines to draw a number
 * in the same situation, so this emits only runs from inside the row's aligned
 * extent.
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

  // The row's aligned extent: first and last column carrying sample sequence.
  // Both stay -1 on an all-gap row, which then emits nothing.
  let firstAligned = -1
  let lastAligned = -1
  for (let i = 0; i < len; i++) {
    if (alnBytes[i] !== DASH && alnBytes[i] !== SPACE) {
      if (firstAligned === -1) {
        firstAligned = i
      }
      lastAligned = i
    }
  }

  let refCount = 0
  let i = 0
  while (i < len) {
    if (refBytes[i] !== DASH && alnBytes[i] === DASH) {
      const delStart = startBp + refCount
      const runStart = i
      let length = 0
      while (i < len && refBytes[i] !== DASH && alnBytes[i] === DASH) {
        length++
        refCount++
        i++
      }
      // `i` lands one past the run, so `i <= lastAligned` means sample sequence
      // follows it, just as `runStart > firstAligned` means sequence precedes it.
      if (runStart > firstAligned && i <= lastAligned) {
        cb(delStart, length)
      }
    } else {
      if (refBytes[i] !== DASH) {
        refCount++
      }
      i++
    }
  }
}
