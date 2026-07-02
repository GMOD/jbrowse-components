import {
  clipBlockForCanvas,
  makeBpMapper,
} from '@jbrowse/render-core/canvas2dUtils'

import { rowBandGeometry } from './visibleRegionGeometry.ts'

import type { MafRegionData } from '../../LinearMafRenderer/mafRenderingBackendTypes.ts'
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

/**
 * Collect the distinct visible regions referenced by a set of render/content
 * blocks. A region can be referenced by more than one block (scissor clips at
 * region boundaries), so dedupe by region index to avoid double-counting bp in
 * `perRowChromRanks`. Shared by the on-screen canvas, the SVG export, and the
 * legend getter so they always rank chromosomes over the same region set.
 */
export function uniqueRegionsFromBlocks(
  blocks: Iterable<{ displayedRegionIndex?: number }>,
  regions: ReadonlyMap<number, MafRegionData>,
): MafRegionData[] {
  const unique = new Map<number, MafRegionData>()
  for (const block of blocks) {
    const idx = block.displayedRegionIndex
    if (idx !== undefined) {
      const region = regions.get(idx)
      if (region) {
        unique.set(idx, region)
      }
    }
  }
  return [...unique.values()]
}

interface DrawSourceChromState {
  rowHeight: number
  rowProportion: number
  /** display row count */
  nRows: number
  canvasWidth: number
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
  const { rowHeight, rowProportion, nRows, canvasWidth } = state
  if (canvasWidth <= 0 || nRows <= 0) {
    return
  }
  const { h: bandH, offset: bandOffset } = rowBandGeometry(
    rowHeight,
    rowProportion,
  )
  // Rank per row over the unique visible regions.
  const { ranks } = perRowChromRanks(uniqueRegionsFromBlocks(blocks, regions))

  for (const block of blocks) {
    const region = regions.get(block.displayedRegionIndex)
    if (region && clipBlockForCanvas(block, canvasWidth)) {
      const bpToX = makeBpMapper(block)
      for (const mafBlock of region.blocks) {
        const xa = bpToX(mafBlock.startBp)
        const xb = bpToX(mafBlock.endBp)
        const xLeft = Math.min(xa, xb)
        const w = Math.max(1, Math.abs(xb - xa))
        for (const row of mafBlock.rows) {
          if (row.rowIndex < nRows && row.chr) {
            const rank = ranks.get(row.rowIndex)?.get(row.chr) ?? 0
            ctx.fillStyle = sourceChromRankColor(rank)
            ctx.fillRect(xLeft, bandOffset + rowHeight * row.rowIndex, w, bandH)
          }
        }
      }
    }
  }
}
