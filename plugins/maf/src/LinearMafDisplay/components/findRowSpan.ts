import { DASH, SPACE } from '../../util/asciiBytes.ts'
import { forwardPos } from './findRowHover.ts'

import type { MafRegionData } from '../../LinearMafRenderer/mafRenderingBackendTypes.ts'

/** An aligned sample's own coordinates, half-open, forward strand. */
export interface RowSpan {
  chr: string
  start: number
  end: number
}

/**
 * The aligned sample's own locus under a reference bp range: the extent of
 * `rowIndex`'s non-gap bases between `startBp` and `endBp`. This is the span
 * form of the single-base coordinate `findRowHoverAtBp` reports, and shares
 * `forwardPos` with it so a `−`-strand row's mirror through `srcSize` can't
 * disagree between the tooltip and a navigation target.
 *
 * A row can change chromosome between blocks (a rearrangement in the aligned
 * genome). The first block contributing a base fixes the chromosome and later
 * blocks on a different one are skipped, so the result is always one navigable
 * locus rather than a span across a join that doesn't exist in that genome.
 *
 * Returns undefined when the row has no aligned base in the range, or when the
 * blocks carry no per-row coordinates (they're optional tooltip metadata).
 */
export function findRowSpan(
  region: MafRegionData,
  startBp: number,
  endBp: number,
  rowIndex: number,
): RowSpan | undefined {
  let chr: string | undefined
  let min = 0
  let max = 0
  for (const block of region.blocks) {
    if (block.startBp >= endBp) {
      break
    }
    if (block.endBp > startBp) {
      const row = block.rows.find(r => r.rowIndex === rowIndex)
      if (row?.chr !== undefined && (chr === undefined || row.chr === chr)) {
        const ref = block.refSeqBytes
        const aln = row.alignmentBytes
        const len = Math.min(ref.length, aln.length)
        let genomicOffset = 0
        let baseOffset = 0
        for (let i = 0; i < len; i++) {
          const code = aln[i]!
          const isBase = code !== DASH && code !== SPACE
          const bp = block.startBp + genomicOffset
          // `bp` only ever increases, so the right edge ends this block's walk.
          // The track menu builds a target per row (`visibleRowTargets`), so on
          // a deep alignment this walk is paid once per species.
          if (bp >= endBp) {
            break
          }
          if (isBase && bp >= startBp) {
            const pos = forwardPos(row, baseOffset)
            if (pos !== undefined) {
              if (chr === undefined) {
                chr = row.chr
                min = pos
                max = pos
              } else {
                min = Math.min(min, pos)
                max = Math.max(max, pos)
              }
            }
          }
          if (isBase) {
            baseOffset++
          }
          if (ref[i] !== DASH) {
            genomicOffset++
          }
        }
      }
    }
  }
  return chr === undefined ? undefined : { chr, start: min, end: max + 1 }
}
