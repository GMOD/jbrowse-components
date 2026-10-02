import { firstDrawn, lastDrawn } from '@jbrowse/core/util/alignedBytes'

import type { RowFlank } from './rowFlank.ts'

export interface ColumnRange {
  /** first column of the range, or -1 when the range is empty */
  firstCol: number
  /** last column of the range (inclusive), or -1 when the range is empty */
  lastCol: number
}

const EMPTY: ColumnRange = { firstCol: -1, lastCol: -1 }

/**
 * The columns of `alnBytes` carrying this sample's own sequence, the extent
 * the mark display's `cells` draws. Empty for a row that is gaps end to end.
 */
export function alignedExtent(
  alnBytes: Uint8Array,
  len = alnBytes.length,
): ColumnRange {
  const firstCol = firstDrawn(alnBytes, 0, len)
  return firstCol === len
    ? EMPTY
    : { firstCol, lastCol: lastDrawn(alnBytes, 0, len, firstCol) }
}

/**
 * The columns whose gap state this block actually determines — what both base
 * painters fill and what `forEachDeletion` is allowed to call a deletion.
 *
 * A gap run reaching the first or last column of a row is only half-observed
 * from inside the block: its length measures where the MAF was chunked, not the
 * alignment. A whole-genome MAF cut on fixed reference intervals turns one
 * unalignable region into a gap run trailing off the end of one block, some
 * blocks the sample is absent from entirely, and a gap run leading into a later
 * block — three fragments of one event, each a partial length. Painting them
 * leaves a gap-colored box hanging off either side of the (blank) middle, and
 * labelling them puts a spurious pair of lengths on it, which is how one 2985bp
 * non-alignment came to read as a "525" and a "460" in the E. coli
 * Minigraph-Cactus track.
 *
 * `flank` is what rescues the runs that are NOT artifacts. When the abutting
 * neighbouring block has this sample resuming aligned sequence right at the
 * seam (see `rowFlank.ts`), the run is bounded on that side after all and its
 * length is exact — the block edge just happened to land next to a real
 * deletion. On that same E. coli track 154 of the 1168 boundary runs are
 * bounded this way, 54 of them 50bp or longer, so treating every boundary run
 * as an artifact hides real events; the other 1014 stay suppressed.
 *
 * An all-gap row is the degenerate case: it is one deletion spanning the whole
 * block only if BOTH neighbours resolve it, and otherwise unobservable.
 */
export function resolvedExtent(
  alnBytes: Uint8Array,
  len: number,
  flank: RowFlank,
): ColumnRange {
  const { firstCol, lastCol } = alignedExtent(alnBytes, len)
  return firstCol === -1
    ? flank.boundedLeft && flank.boundedRight
      ? { firstCol: 0, lastCol: len - 1 }
      : EMPTY
    : {
        firstCol: flank.boundedLeft ? 0 : firstCol,
        lastCol: flank.boundedRight ? len - 1 : lastCol,
      }
}
