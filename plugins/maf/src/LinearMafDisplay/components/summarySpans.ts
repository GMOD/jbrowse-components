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
 * record whose `src` names no display row draws nothing.
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
  const cap = records.length
  const x = new Uint32Array(cap)
  const x2 = new Uint32Array(cap)
  const row = new Uint32Array(cap)
  const color = new Uint32Array(cap)
  const kept: MafSummaryRecord[] = []
  for (const r of records) {
    const rowIndex = rowIndexBySrc.get(r.src)
    if (rowIndex !== undefined) {
      const i = kept.length
      x[i] = r.start
      x2[i] = r.end
      row[i] = rowIndex
      color[i] = withAbgrAlpha(base, Math.round(summaryBarAlpha(r.score) * 255))
      kept.push(r)
    }
  }
  const count = kept.length
  return count === cap
    ? { x, x2, row, color, count, records: kept }
    : {
        x: x.slice(0, count),
        x2: x2.slice(0, count),
        row: row.slice(0, count),
        color: color.slice(0, count),
        count,
        records: kept,
      }
}

/**
 * The summary record drawn under canvas x `x` on display row `rowIndex`, or
 * undefined: the zoom-out tier's only hover. Hit-tested against the mark's own
 * ink, since a block narrower than a pixel is widened to one. Half-open at the
 * right edge, so adjacent bars do not both match.
 */
export function summaryAt(
  payloads: ReadonlyMap<number, MafRowsPayload>,
  blocks: readonly RenderBlock[],
  state: MafGPURenderState,
  rowIndex: number,
  x: number,
): MafSummaryRecord | undefined {
  for (const block of blocks) {
    const payload = payloads.get(block.displayedRegionIndex)
    const spans = payload?.summary
    if (spans && x >= block.screenStartPx && x < block.screenEndPx) {
      for (let i = 0; i < spans.count; i++) {
        if (spans.row[i] === rowIndex) {
          const ink = MAF_SUMMARY_MARK.ink!(payload, block, state, i)
          if (ink && x >= ink.left && x < ink.left + ink.width) {
            return spans.records[i]
          }
        }
      }
    }
  }
  return undefined
}
