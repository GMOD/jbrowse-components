import {
  forEachClippedBlock,
  makeBpMapper,
} from '@jbrowse/render-core/canvas2dUtils'

import { paintedBpRange } from './paintedBpRange.ts'
import {
  bpSpanPx,
  rowBandGeometry,
  visibleRowRange,
} from './visibleRegionGeometry.ts'

import type { MafRegionData } from '../../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { LegendItem } from '@jbrowse/core/ui'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

// Per-rank palette for the color-by-source-chromosome mode. Coloring is by a
// source chromosome's RANK within its own species row (see perRowChromRanks) —
// not by the chromosome name — so every row's main chromosome shares rank 0's
// calm primary color and the whole track reads as one color except where a row
// switches to a minority source chromosome (the rearrangement signal), which
// picks up a saturated accent. This is what keeps the view from becoming a
// rainbow when hundreds of species each use their own scaffold-naming scheme.
export const SOURCE_CHROM_PALETTE = [
  'hsl(210, 55%, 55%)', // rank 0 — primary (main chromosome), calm blue
  'hsl(28, 85%, 55%)', // rank 1 — orange
  'hsl(350, 70%, 57%)', // rank 2 — crimson
  'hsl(275, 45%, 58%)', // rank 3 — purple
  'hsl(150, 45%, 42%)', // rank 4+ — green
]

// Rank -> color, clamped to the last palette entry for deep ranks.
export function sourceChromRankColor(rank: number): string {
  return SOURCE_CHROM_PALETTE[Math.min(rank, SOURCE_CHROM_PALETTE.length - 1)]!
}

// Descriptive legend labels paired with the palette (index = rank). Tail ranks
// reuse the last "other" label, matching the clamped color.
const RANK_LABELS = [
  'Main chromosome',
  '2nd source',
  '3rd source',
  '4th source',
  'Other source',
]

export function sourceChromRankLabel(rank: number): string {
  return RANK_LABELS[Math.min(rank, RANK_LABELS.length - 1)]!
}

/**
 * The color key for the source-chromosome rendering: one row per rank present
 * in view, capped at the palette's last entry.
 *
 * The cap is the point, and it belongs here with the two clamps it follows from
 * rather than in the model, which only knew the max rank. Both the color and
 * the label saturate at the last slot ("Other source"), so ranking a row across
 * more source chromosomes than the palette has — routine for a scaffold-level
 * assembly in a many-way alignment, where one row can draw from dozens —
 * emitted an identical "Other source" row per extra rank. The key then grew
 * with the fragmentation of the worst genome on screen while saying nothing new
 * past the fifth entry, and on a tall alignment it grew over the rows.
 *
 * A lone "Main chromosome" entry is the meaningful minimum: it says nothing in
 * view is rearranged.
 */
export function sourceChromLegendItems(maxRank: number): LegendItem[] {
  const shown = Math.min(maxRank, SOURCE_CHROM_PALETTE.length - 1) + 1
  return Array.from({ length: shown }, (_, rank) => ({
    label: sourceChromRankLabel(rank),
    color: sourceChromRankColor(rank),
  }))
}

/**
 * Rank each display row's source chromosomes by descending aligned bp, so rank 0
 * is that row's dominant (main) chromosome. Returns `rowIndex -> (chr -> rank)`
 * plus the max rank present (for sizing the legend). Pure over the region data,
 * so the on-screen canvas, the SVG export, and the legend getter can share it
 * and never disagree about which color a row's chromosome gets.
 */
export function perRowChromRanks(regions: Iterable<MafRegionData>): {
  ranks: Map<number, Map<string, number>>
  maxRank: number
} {
  const bpByRowChr = new Map<number, Map<string, number>>()
  for (const region of regions) {
    for (const mafBlock of region.blocks) {
      const len = mafBlock.endBp - mafBlock.startBp
      for (const row of mafBlock.rows) {
        if (row.chr) {
          let byChr = bpByRowChr.get(row.rowIndex)
          if (!byChr) {
            byChr = new Map()
            bpByRowChr.set(row.rowIndex, byChr)
          }
          byChr.set(row.chr, (byChr.get(row.chr) ?? 0) + len)
        }
      }
    }
  }
  const ranks = new Map<number, Map<string, number>>()
  let maxRank = 0
  for (const [rowIndex, byChr] of bpByRowChr) {
    const ordered = [...byChr].sort((a, b) => b[1] - a[1])
    const rankMap = new Map<string, number>()
    for (const [i, [chr]] of ordered.entries()) {
      rankMap.set(chr, i)
    }
    ranks.set(rowIndex, rankMap)
    maxRank = Math.max(maxRank, ordered.length - 1)
  }
  return { ranks, maxRank }
}

interface DrawSourceChromState {
  rowHeight: number
  rowProportion: number
  /** display row count */
  nRows: number
  canvasWidth: number
  /** the rows viewport (the canvas), which with `scrollTop` picks the rows drawn */
  canvasHeight: number
  scrollTop: number
  /**
   * `rowIndex -> (chr -> rank)` from the model's `sourceChromRanks` computed.
   * Passed in rather than derived here: the walk covers every block × row of
   * every visible region, and this draw re-fires on every pan and zoom, so
   * computing it here recomputed per frame what the legend had already memoized.
   */
  ranks: ReadonlyMap<number, ReadonlyMap<string, number>>
}

/**
 * Color-by-source-chromosome rendering over the (cleared) GPU base canvas: each
 * species row's alignment blocks are filled by the RANK of their source
 * chromosome within that row (`perRowChromRanks`) — the row's main chromosome is
 * the primary color, a switch to a minority source chromosome takes an accent
 * color — so a translocation/rearrangement reads as a color change along the row
 * without a global name→color rainbow. `MafAlignedRow.chr` is already shipped, so
 * no extra fetch. Replaces the base SNP rendering when active (see
 * `activeRowRendering`); rows with no `chr` are left untouched. Shared by the
 * on-screen canvas and SVG export, like `drawRowIdentity`.
 */
export function drawSourceChrom(
  ctx: Ctx2D,
  blocks: RenderBlock[],
  regions: ReadonlyMap<number, MafRegionData>,
  state: DrawSourceChromState,
) {
  const {
    rowHeight,
    rowProportion,
    nRows,
    canvasWidth,
    canvasHeight,
    scrollTop,
    ranks,
  } = state
  if (canvasWidth <= 0 || nRows <= 0) {
    return
  }
  const { h: bandH, offset: bandOffset } = rowBandGeometry(
    rowHeight,
    rowProportion,
    scrollTop,
  )
  const { firstRow, endRow } = visibleRowRange(
    rowHeight,
    scrollTop,
    canvasHeight,
  )
  const lastRow = Math.min(endRow, nRows)

  // Scissor to each block's own columns: the fetched region is the *buffered*
  // one, so its MAF blocks extend past the render block's screen span, and a
  // region referenced by two render blocks would otherwise paint twice under
  // two different mappings — smeared over the neighboring region.
  forEachClippedBlock(
    ctx,
    blocks,
    canvasWidth,
    canvasHeight,
    block => regions.get(block.displayedRegionIndex),
    (region, block, clip) => {
      const bpToX = makeBpMapper(block)
      // The buffered region's off-screen blocks would emit a fill per row that
      // the clip then throws away — about half of them at a typical view.
      const { overlaps } = paintedBpRange(block, clip)
      // Assigning `fillStyle` re-parses the CSS color string every time, and
      // this loop is blocks × visible rows — over a million iterations per
      // frame on the ce11 26-way shape. The palette has five entries and the
      // *point* of ranking is that nearly every row is rank 0, so tracking the
      // last color assigned turns almost all of those back into a plain
      // `fillRect`. Same reasoning as the run-length fill in `drawRowIdentity`,
      // and lossless for the same reason: the pixels painted are identical.
      let lastFill: string | undefined
      for (const { startBp, endBp, rows } of region.blocks) {
        if (overlaps(startBp, endBp)) {
          // >=1px so a block narrower than a pixel still reads as present
          const { xLeft, width } = bpSpanPx(bpToX, startBp, endBp, 1)
          for (const row of rows) {
            if (row.rowIndex >= firstRow && row.rowIndex < lastRow && row.chr) {
              const rank = ranks.get(row.rowIndex)?.get(row.chr) ?? 0
              const fill = sourceChromRankColor(rank)
              if (fill !== lastFill) {
                ctx.fillStyle = fill
                lastFill = fill
              }
              const y = bandOffset + rowHeight * row.rowIndex
              ctx.fillRect(xLeft, y, width, bandH)
            }
          }
        }
      }
    },
  )
}
