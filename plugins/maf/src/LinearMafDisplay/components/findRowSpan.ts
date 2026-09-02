import { DASH, SPACE } from '../../util/asciiBytes.ts'
import { forwardPos } from './findRowHover.ts'

import type {
  MafAlignedRow,
  MafBlock,
  MafRegionData,
} from '../../LinearMafRenderer/mafRenderingBackendTypes.ts'

/** An aligned sample's own coordinates, half-open, forward strand. */
export interface RowSpan {
  chr: string
  start: number
  end: number
}

// Widen `spans[row.rowIndex]` by the row's own coordinates over the reference
// range. A row whose block names a different chromosome than the one already
// recorded contributes nothing, which is what keeps the answer one navigable
// locus across a rearrangement in the aligned genome.
function widenRowSpan(
  spans: Map<number, RowSpan>,
  block: MafBlock,
  row: MafAlignedRow,
  startBp: number,
  endBp: number,
) {
  const chr = row.chr
  const current = spans.get(row.rowIndex)
  if (chr !== undefined && (current === undefined || current.chr === chr)) {
    const ref = block.refSeqBytes
    const aln = row.alignmentBytes
    const len = Math.min(ref.length, aln.length)
    let genomicOffset = 0
    let baseOffset = 0
    let min = 0
    let max = 0
    let found = false
    for (let i = 0; i < len; i++) {
      const code = aln[i]!
      const isBase = code !== DASH && code !== SPACE
      const bp = block.startBp + genomicOffset
      // `bp` only ever increases, so the right edge ends this block's walk
      if (bp >= endBp) {
        break
      }
      if (isBase && bp >= startBp) {
        const pos = forwardPos(row, baseOffset)
        if (pos !== undefined) {
          min = found ? Math.min(min, pos) : pos
          max = found ? Math.max(max, pos) : pos
          found = true
        }
      }
      if (isBase) {
        baseOffset++
      }
      if (ref[i] !== DASH) {
        genomicOffset++
      }
    }
    if (found) {
      spans.set(
        row.rowIndex,
        current
          ? {
              chr,
              start: Math.min(current.start, min),
              end: Math.max(current.end, max + 1),
            }
          : { chr, start: min, end: max + 1 },
      )
    }
  }
}

/**
 * Each requested row's own locus under a reference bp range: the extent of that
 * row's non-gap bases between `startBp` and `endBp`. This is the span form of
 * the single-base coordinate `findRowHoverAtBp` reports, and shares
 * `forwardPos` with it so a `−`-strand row's mirror through `srcSize` can't
 * disagree between the tooltip and a navigation target.
 *
 * A row can change chromosome between blocks (a rearrangement in the aligned
 * genome). The first block contributing a base fixes the chromosome and later
 * blocks on a different one are skipped, so each result is one navigable locus
 * rather than a span across a join that doesn't exist in that genome.
 *
 * A row with no aligned base in the range is absent from the result, as is one
 * whose blocks carry no per-row coordinates (they're optional tooltip
 * metadata).
 *
 * **Every requested row in one walk**, because the track menu asks for all of
 * them at once (`visibleRowTargets`). Answering one row at a time meant a pass
 * over the whole buffered region per row, each block of it scanned with
 * `rows.find` — a cohort MAF's row count squared, times the block count, on
 * every track-menu open.
 */
export function findRowSpans(
  region: MafRegionData,
  startBp: number,
  endBp: number,
  rowIndices: ReadonlySet<number>,
) {
  const spans = new Map<number, RowSpan>()
  for (const block of region.blocks) {
    if (block.startBp >= endBp) {
      break
    }
    if (block.endBp > startBp) {
      for (const row of block.rows) {
        if (rowIndices.has(row.rowIndex)) {
          widenRowSpan(spans, block, row, startBp, endBp)
        }
      }
    }
  }
  return spans
}
