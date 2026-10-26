import { keyNames } from '@jbrowse/core/util/categoricalField'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'

import { blockIndexAtBp } from '../../LinearMafRenderer/blockAtBp.ts'
import { rowChromBp } from './rowChromBp.ts'

import type {
  MafAlignedRow,
  MafBlock,
  MafRegionData,
} from '../../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { LegendItem } from '@jbrowse/core/ui'
import type { SpanChannels } from '@jbrowse/render-core/marks'

// Per-rank palette for color-by-source-chromosome. Coloring is by a
// chromosome's rank within its own species row (`perRowChromRanks`), not its
// name, so every row's main chromosome shares rank 0's calm color and a
// minority source chromosome (the rearrangement signal) picks up a saturated
// accent.
export const SOURCE_CHROM_PALETTE = [
  'hsl(210, 55%, 55%)', // rank 0 — primary (main chromosome), calm blue
  'hsl(28, 85%, 55%)', // rank 1 — orange
  'hsl(350, 70%, 57%)', // rank 2 — crimson
  'hsl(275, 45%, 58%)', // rank 3 — purple
  'hsl(150, 45%, 42%)', // rank 4+ — green
]

// Legend labels paired with the palette (index = rank); tail ranks reuse the
// last "other" label, matching the clamped color.
export const SOURCE_CHROM_RANK_LABELS = [
  'Main chromosome',
  '2nd source',
  '3rd source',
  '4th source',
  'Other source',
]

export function sourceChromRankLabel(rank: number): string {
  return SOURCE_CHROM_RANK_LABELS[
    Math.min(rank, SOURCE_CHROM_RANK_LABELS.length - 1)
  ]!
}

/**
 * The color key for the source-chromosome rendering: one row per rank present
 * in view, capped at the palette's last entry, where color and label both
 * saturate ("Other source"). A lone "Main chromosome" entry means nothing in
 * view is rearranged. A rank `encoding.color.scale.names` names takes that
 * name, and a written `scale.range` its colors.
 */
export function sourceChromLegendItems(
  maxRank: number,
  {
    domain = [],
    names = [],
    range = SOURCE_CHROM_PALETTE,
  }: {
    domain?: readonly (string | number)[]
    names?: readonly string[]
    range?: readonly string[]
  } = {},
): LegendItem[] {
  const keyed = keyNames(domain, names)
  const shown = Math.min(maxRank, range.length - 1) + 1
  return Array.from({ length: shown }, (_, rank) => ({
    label: keyed.get(String(rank)) ?? sourceChromRankLabel(rank),
    color: range[rank]!,
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
  const ranks = new Map<number, Map<string, number>>()
  let maxRank = 0
  for (const [rowIndex, byChr] of rowChromBp(regions)) {
    const ordered = [...byChr]
      .filter(([chr]) => chr)
      .map(([chr, { fwd, rev }]) => [chr, fwd + rev] as const)
      .sort((a, b) => b[1] - a[1])
    if (ordered.length > 0) {
      const rankMap = new Map<string, number>()
      for (const [i, [chr]] of ordered.entries()) {
        rankMap.set(chr, i)
      }
      ranks.set(rowIndex, rankMap)
      maxRank = Math.max(maxRank, ordered.length - 1)
    }
  }
  return { ranks, maxRank }
}

const RANK_ABGR = SOURCE_CHROM_PALETTE.map(cssColorToABGR)

const DEFAULT_RANK_KEY = SOURCE_CHROM_PALETTE.join('\n')
const MAX_RANK_TABLES = 16
const rankTables = new Map<string, readonly number[]>()

/**
 * Each rank's packed color, the last painting every rank past it: `range`'s
 * colors where it lists any, else `SOURCE_CHROM_PALETTE`. The same array for
 * the same range, so a color edit that leaves it alone re-encodes nothing.
 */
export function sourceChromRankColors(
  range: readonly string[] = SOURCE_CHROM_PALETTE,
) {
  const key = range.join('\n')
  if (range.length === 0 || key === DEFAULT_RANK_KEY) {
    return RANK_ABGR
  }
  let colors = rankTables.get(key)
  if (!colors) {
    if (rankTables.size >= MAX_RANK_TABLES) {
      rankTables.delete(rankTables.keys().next().value!)
    }
    colors = range.map(cssColorToABGR)
    rankTables.set(key, colors)
  }
  return colors
}

/**
 * The color-by-source-chromosome rows as `span` channels: one instance per
 * aligned row per block, across the block's reference extent, colored by the
 * row's rank for its source chromosome. A row the adapter named no `chr` for
 * draws nothing. Blocks outer, rows inner, which is the paint order.
 */
export function encodeSourceChromSpans(
  blocks: readonly MafBlock[],
  ranks: ReadonlyMap<number, ReadonlyMap<string, number>>,
  rankColors: readonly number[] = RANK_ABGR,
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
  const last = rankColors.length - 1
  const chrOfRow: (string | undefined)[] = []
  const colorOfRow: number[] = []
  let i = 0
  for (const { startBp, endBp, rows } of blocks) {
    for (const { rowIndex, chr } of rows) {
      if (chr) {
        if (chrOfRow[rowIndex] !== chr) {
          const rank = ranks.get(rowIndex)?.get(chr) ?? 0
          chrOfRow[rowIndex] = chr
          colorOfRow[rowIndex] = rankColors[Math.min(rank, last)]!
        }
        x[i] = startBp
        x2[i] = endBp
        row[i] = rowIndex
        color[i] = colorOfRow[rowIndex]!
        i++
      }
    }
  }
  return { x, x2, row, color, count }
}

function rowAt(rows: readonly MafAlignedRow[], rowIndex: number) {
  let lo = 0
  let hi = rows.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (rows[mid]!.rowIndex < rowIndex) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }
  let found: MafAlignedRow | undefined
  for (let i = lo; rows[i]?.rowIndex === rowIndex; i++) {
    found = rows[i]
  }
  return found
}

/**
 * The rank color of the block each bar starts in, so the X-Y plot's bars take
 * the colors the cells would. A bar spanning two source sequences takes its
 * first base's, as a sampled cell does. A block lists its rows in row order
 * (`placeMafRegionData`), so the row is a binary search, and of two lines on
 * one row (a paralog) it takes the last, the one the spans paint on top.
 */
export function sourceChromBarColors(
  blocks: readonly MafBlock[],
  bars: { x: Uint32Array; row: Uint32Array; count: number },
  ranks: ReadonlyMap<number, ReadonlyMap<string, number>>,
  rankColors: readonly number[] = RANK_ABGR,
) {
  const last = rankColors.length - 1
  const colors = new Uint32Array(bars.count)
  for (let i = 0; i < bars.count; i++) {
    const b = blockIndexAtBp(blocks, bars.x[i]!)
    const chr = b === -1 ? undefined : rowAt(blocks[b]!.rows, bars.row[i]!)?.chr
    const rank = chr ? (ranks.get(bars.row[i]!)?.get(chr) ?? 0) : 0
    colors[i] = rankColors[Math.min(rank, last)]!
  }
  return colors
}
