import { cssColorToABGR } from '@jbrowse/core/util/colorBits'

import type {
  MafBlock,
  MafRegionData,
} from '../../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { LegendItem } from '@jbrowse/core/ui'
import type { SpanChannels } from '@jbrowse/render-core/marks'

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
 * so the span encode and the legend getter can share it and never disagree
 * about which color a row's chromosome gets.
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

const RANK_ABGR = SOURCE_CHROM_PALETTE.map(cssColorToABGR)

/**
 * The color-by-source-chromosome rows as `span` channels: one instance per
 * aligned row per block, across the block's reference extent, colored by the
 * row's rank for its source chromosome. A row the adapter named no `chr` for
 * draws nothing. Blocks outer, rows inner, which is the paint order.
 */
export function encodeSourceChromSpans(
  blocks: readonly MafBlock[],
  ranks: ReadonlyMap<number, ReadonlyMap<string, number>>,
): SpanChannels {
  let count = 0
  for (const { rows } of blocks) {
    for (const row of rows) {
      if (row.chr) {
        count++
      }
    }
  }
  const x = new Uint32Array(count)
  const x2 = new Uint32Array(count)
  const row = new Uint32Array(count)
  const color = new Uint32Array(count)
  const last = RANK_ABGR.length - 1
  let i = 0
  for (const { startBp, endBp, rows } of blocks) {
    for (const { rowIndex, chr } of rows) {
      if (chr) {
        const rank = ranks.get(rowIndex)?.get(chr) ?? 0
        x[i] = startBp
        x2[i] = endBp
        row[i] = rowIndex
        color[i] = RANK_ABGR[Math.min(rank, last)]!
        i++
      }
    }
  }
  return { x, x2, row, color, count }
}
