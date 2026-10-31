import { cssColorToABGR, withAbgrAlpha } from '@jbrowse/core/util/colorBits'

import { MAF_SUMMARY_MARK } from '../../LinearMafRenderer/mafMarks.ts'

import type {
  MafGPURenderState,
  MafRowsPayload,
  MafSummarySpans,
} from '../../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { MafSummaryRecord } from '../../types.ts'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

// `score` is the UCSC `bigMafSummary` score: a normalized HOXD70 log-odds
// alignment score, not a percent identity (the conservation band shows that).
// Low-score blocks still read as present, so map 0..1 onto a floor..1 alpha.
const MIN_ALPHA = 0.25

export function summaryBarAlpha(score: number) {
  const clamped = Math.max(0, Math.min(1, score))
  return MIN_ALPHA + (1 - MIN_ALPHA) * clamped
}

/**
 * The zoom-out per-species presence bars as `span` channels: one instance per
 * summary block per species, across the block's reference extent on the
 * species' row, in the alignment `matchColor` at a score-proportional alpha. A
 * record whose `src` names no display row draws nothing. The bars come in row
 * order, as the cells do, so the row the hover names is the one painted last.
 *
 * `records[i]` is the record instance `i` draws. The painter reads none of it,
 * but the hover does: `leftStatus`/`rightStatus` say what sits between two
 * runs, and a `maf2bed --summary` BED omits them, so every reader tolerates
 * their absence.
 */
export function encodeSummarySpans(
  records: readonly MafSummaryRecord[],
  rowIndexBySrc: ReadonlyMap<string, number>,
  matchColor: string,
): MafSummarySpans {
  const base = cssColorToABGR(matchColor)
  const placed: { record: MafSummaryRecord; rowIndex: number }[] = []
  for (const record of records) {
    const rowIndex = rowIndexBySrc.get(record.src)
    if (rowIndex !== undefined) {
      placed.push({ record, rowIndex })
    }
  }
  placed.sort((a, b) => a.rowIndex - b.rowIndex)
  const count = placed.length
  const x = new Uint32Array(count)
  const x2 = new Uint32Array(count)
  const row = new Uint32Array(count)
  const color = new Uint32Array(count)
  for (const [i, { record, rowIndex }] of placed.entries()) {
    x[i] = record.start
    x2[i] = record.end
    row[i] = rowIndex
    color[i] = withAbgrAlpha(
      base,
      Math.round(summaryBarAlpha(record.score) * 255),
    )
  }
  return {
    x,
    x2,
    row,
    color,
    count,
    records: placed.map(p => p.record),
  }
}

/**
 * The summary record drawn under canvas x `x` on display row `rowIndex`, or
 * undefined: the zoom-out tier's only hover. Hit-tested against the mark's own
 * ink, since a block narrower than a pixel is widened to one. Half-open at the
 * right edge, so adjacent bars do not both match; where widened bars overlap,
 * the one painted last, on top.
 */
export function summaryAt(
  payloads: ReadonlyMap<number, MafRowsPayload>,
  blocks: readonly RenderBlock[],
  state: MafGPURenderState,
  rowIndex: number,
  x: number,
): MafSummaryRecord | undefined {
  let hit: MafSummaryRecord | undefined
  for (const block of blocks) {
    const payload = payloads.get(block.displayedRegionIndex)
    const spans = payload?.summary
    if (spans && x >= block.screenStartPx && x < block.screenEndPx) {
      for (let i = 0; i < spans.count; i++) {
        if (spans.row[i] === rowIndex) {
          const ink = MAF_SUMMARY_MARK.ink!(payload, block, state, i)
          if (ink && x >= ink.left && x < ink.left + ink.width) {
            hit = spans.records[i]
          }
        }
      }
    }
  }
  return hit
}
