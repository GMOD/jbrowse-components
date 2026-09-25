import { clipBlockForCanvas } from '@jbrowse/render-core/canvas2dUtils'

import {
  EMPTY_MAF_CELLS,
  buildMafChannels,
} from '../LinearMafRenderer/mafChannels.ts'
import { encodeSourceChromSpans } from './components/drawSourceChrom.ts'
import { paintedBpRange } from './components/paintedBpRange.ts'
import { encodeSummarySpans } from './components/summarySpans.ts'

import type {
  MafCoverageRegion,
  MafGpuProps,
  MafRegionData,
  MafRowsPayload,
} from '../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { MafSummaryRecord } from '../types.ts'
import type { SpanChannels } from '@jbrowse/render-core/marks'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

/**
 * The coverage a region with no alignment uploads: nothing. A summary-only
 * region still needs a payload for its bars, and the band's marks pack every
 * payload's coverage buffers.
 */
export const EMPTY_MAF_COVERAGE: MafCoverageRegion = {
  coverageDepths: new Float32Array(0),
  coverageStartPos: 0,
  coverageMaxDepth: 0,
  coverageBinSize: 1,
  identityScores: new Float32Array(0),
  mismatchPositions: new Uint32Array(0),
  mismatchBases: new Uint8Array(0),
  insertionPositions: new Uint32Array(0),
  insertionLengths: new Uint32Array(0),
  coveragePackedBuffer: new ArrayBuffer(0),
  snpPackedBuffer: new ArrayBuffer(0),
  interbasePackedBuffer: new ArrayBuffer(0),
  interbaseMaxCount: 0,
  indicatorPackedBuffer: new ArrayBuffer(0),
}

/** Everything a region's rows encode reads beyond the region itself. */
export interface MafRowsEncodeProps {
  /** The rows are drawn base by base (`basesRenderingActive`). */
  basesActive: boolean
  gpu: MafGpuProps
  /** The rows' source-chromosome ranks, while the rows are colored by them. */
  sourceChromRanks: ReadonlyMap<number, ReadonlyMap<string, number>> | undefined
  rowIndexBySrc: ReadonlyMap<string, number>
}

/**
 * What one region's rows draw from: the detail tier's alignment, the summary
 * tier's records where they stand in, or both while the summary tier is up
 * over alignment still cached beneath it.
 */
export interface MafRowsSource {
  detail: MafRegionData | undefined
  summary: readonly MafSummaryRecord[] | undefined
}

/**
 * One region's rows as the row marks' channels. Only the rendering on screen
 * encodes: the others' channels are empty or absent, which packs nothing and
 * releases the pass's GPU buffer.
 */
export function encodeMafRows(
  { detail, summary }: MafRowsSource,
  { basesActive, gpu, sourceChromRanks, rowIndexBySrc }: MafRowsEncodeProps,
): MafRowsPayload {
  return {
    cells:
      basesActive && detail
        ? buildMafChannels({ blocks: detail.blocks, ...gpu })
        : EMPTY_MAF_CELLS,
    sourceChrom:
      sourceChromRanks &&
      detail &&
      encodeSourceChromSpans(detail.blocks, sourceChromRanks),
    summary:
      summary &&
      encodeSummarySpans(summary, rowIndexBySrc, gpu.palette.matchColor),
  }
}

function pickSpans(spans: SpanChannels, kept: readonly number[]) {
  const pick = (a: Uint32Array) => Uint32Array.from(kept, i => a[i]!)
  return {
    x: pick(spans.x),
    x2: pick(spans.x2),
    row: pick(spans.row),
    color: pick(spans.color),
    count: kept.length,
  }
}

/**
 * `payload` less the instances no block of its region can show: rows scrolled
 * out of `rows`, and spans outside every block's painted bp range. What the
 * SVG export paints, since a vector layer emits a `<rect>` for every fill
 * whether or not a clip then hides it.
 */
export function cullMafRows(
  payload: MafRowsPayload,
  blocks: readonly RenderBlock[],
  canvasWidth: number,
  rows: { firstRow: number; endRow: number },
): MafRowsPayload {
  const ranges = blocks.flatMap(block => {
    const clip = clipBlockForCanvas(block, canvasWidth)
    return clip ? [paintedBpRange(block, clip)] : []
  })
  const shown = (spans: SpanChannels) => {
    const kept: number[] = []
    for (let i = 0; i < spans.count; i++) {
      const row = spans.row[i]!
      if (
        row >= rows.firstRow &&
        row < rows.endRow &&
        ranges.some(r => r.overlaps(spans.x[i]!, spans.x2[i]!))
      ) {
        kept.push(i)
      }
    }
    return kept
  }
  const { cells, sourceChrom, summary } = payload
  const summaryKept = summary && shown(summary)
  return {
    cells: pickSpans(cells, shown(cells)),
    sourceChrom: sourceChrom && pickSpans(sourceChrom, shown(sourceChrom)),
    summary: summary &&
      summaryKept && {
        ...pickSpans(summary, summaryKept),
        records: summaryKept.map(i => summary.records[i]!),
      },
  }
}

/**
 * Pairs each region's two tiers into one `MafRowsSource`, handing back the
 * same object while neither tier's reference moved, so an encode memo keyed
 * on it re-encodes a region only when one of its tiers did.
 */
export function createRowsSourceJoin() {
  let last = new Map<number, MafRowsSource>()
  return (
    detail: ReadonlyMap<number, MafRegionData>,
    summary: ReadonlyMap<number, readonly MafSummaryRecord[]>,
  ): ReadonlyMap<number, MafRowsSource> => {
    const next = new Map<number, MafRowsSource>()
    for (const key of new Set([...detail.keys(), ...summary.keys()])) {
      const d = detail.get(key)
      const s = summary.get(key)
      const prev = last.get(key)
      next.set(
        key,
        prev && prev.detail === d && prev.summary === s
          ? prev
          : { detail: d, summary: s },
      )
    }
    last = next
    return next
  }
}
