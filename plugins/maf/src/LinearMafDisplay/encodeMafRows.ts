import { textWidthForNumber } from '@jbrowse/alignments-core'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import { clipBlockForCanvas } from '@jbrowse/render-core/canvas2dUtils'

import {
  XYPLOT_BAR_COLOR,
  buildIdentityRuns,
  identityBars,
  identityRunColors,
  identitySpans,
} from '../LinearMafRenderer/identity.ts'
import {
  EMPTY_MAF_CELLS,
  buildMafChannels,
} from '../LinearMafRenderer/mafChannels.ts'
import { mafInsertionChannels } from '../LinearMafRenderer/rendering/insertions.ts'
import {
  encodeCodonConservation,
  encodeCodonSpans,
  locateRegionCodons,
} from './codons.ts'
import { encodeConservation } from './components/conservationBand.ts'
import { paintedBpRange } from './components/paintedBpRange.ts'
import {
  encodeRefNameRankSpans,
  refNameRankBarColors,
} from './components/refNameRanks.ts'
import { encodeSummarySpans } from './components/summarySpans.ts'
import { basePaintsOf } from './rowPlan.ts'

import type {
  MafCoverageRegion,
  MafGpuProps,
  MafIdentityBars,
  MafRegionData,
  MafRowsPayload,
} from '../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { MafFrameRecord, MafSummaryRecord } from '../types.ts'
import type { CodonFills } from './codons.ts'
import type { RowPlan } from './rowPlan.ts'
import type { InsertionChannels } from '@jbrowse/alignments-core'
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
  indicatorPositions: new Uint32Array(0),
  indicatorTypes: new Float32Array(0),
}

const WIDEST_MARKER_PX = textWidthForNumber(Number.MAX_SAFE_INTEGER)

/** Everything a region's rows encode reads beyond the region itself. */
export interface MafRowsEncodeProps {
  plan: RowPlan
  /** `encoding.color.value`, the fill while no field paints */
  value: string | undefined
  /** the identity ramp's packed color at each hundredth (`identityLut`) */
  identityColors: Uint32Array
  gpu: MafGpuProps
  /** The rows' source-sequence ranks, while `refNameRank` fills the rows. */
  refNameRanks: ReadonlyMap<number, ReadonlyMap<string, number>> | undefined
  /** each rank's packed color (`refNameRankColors`) */
  refNameRankPalette: readonly number[]
  rowIndexBySrc: ReadonlyMap<string, number>
  /**
   * The codons to locate, while the codon layer or the band's codon mode
   * draws: the anchor species whose frames define them, and the reference
   * row the band leaves out.
   */
  codons:
    | { anchor: string; cells: boolean; band: boolean; refRowIndex: number }
    | undefined
  /** The conservation band draws per base. */
  conservation: boolean
}

/**
 * What one region's rows draw from: the detail tier's alignment, or the
 * summary tier's records while that tier is up or the alignment has yet to
 * land.
 */
export interface MafRowsSource {
  detail: MafRegionData | undefined
  summary: readonly MafSummaryRecord[] | undefined
  /** the CDS frames under the region, from whichever tier carries them */
  frames: MafFrameRecord[] | undefined
}

function codonFills(fill: Record<string, string | undefined>): CodonFills {
  const pack = (css: string | undefined) =>
    css === undefined ? undefined : cssColorToABGR(css)
  return {
    same: pack(fill.same),
    syn: pack(fill.syn),
    nonsyn: pack(fill.nonsyn),
    stop: pack(fill.stop),
  }
}

/** The cells' fill where a field fills the rows with marks of its own. */
const NO_FILL = 'rgba(0,0,0,0)'

/**
 * One region's rows as the row marks' channels: the fill `encoding.color`
 * gives the cells or bars, then the layers over it. A constant fill is the
 * cells' match color, so one walk draws it and the mismatches; a field fills
 * through its own spans, and the cells walk then draws only the bases that
 * paint. Only what draws encodes: the others' channels are empty, which packs
 * nothing and releases the pass's GPU buffer.
 *
 * Main thread on purpose, so a color or row-order edit re-encodes without a
 * refetch (cost: `plugins/maf/benches/mafEncodeRows.bench.ts`).
 */
export function encodeMafRows(
  { detail, summary, frames }: MafRowsSource,
  {
    plan,
    value,
    identityColors,
    gpu,
    refNameRanks,
    refNameRankPalette,
    rowIndexBySrc,
    codons: codonProps,
    conservation,
  }: MafRowsEncodeProps,
): MafRowsPayload {
  const { palette, binBp } = gpu
  const rect = plan.mark === 'rect'
  const runs =
    detail && (plan.color === 'identity' || !rect)
      ? buildIdentityRuns(detail.blocks, binBp)
      : undefined
  const codons =
    codonProps && detail && frames
      ? locateRegionCodons(detail, frames, codonProps.anchor)
      : undefined
  const bandColor = cssColorToABGR(palette.conservationColor)
  const ranks = plan.color === 'refNameRank' ? refNameRanks : undefined
  return {
    cells:
      detail && rect && (plan.color === undefined || plan.perBase)
        ? buildMafChannels({
            blocks: detail.blocks,
            palette,
            binBp,
            matchColor:
              plan.color === undefined
                ? (value ?? palette.matchColor)
                : NO_FILL,
            paints: basePaintsOf(plan),
          })
        : EMPTY_MAF_CELLS,
    insertions:
      plan.perBase && detail
        ? mafInsertionChannels(
            detail,
            cssColorToABGR(palette.insertionColor),
            binBp,
          )
        : undefined,
    refNameRank:
      rect && ranks && detail
        ? encodeRefNameRankSpans(detail.blocks, ranks, refNameRankPalette)
        : undefined,
    summary:
      summary &&
      encodeSummarySpans(summary, rowIndexBySrc, value ?? palette.matchColor),
    identity: runs && rect ? identitySpans(runs, identityColors) : undefined,
    identityBars:
      runs && !rect && detail
        ? identityBars(
            runs,
            plan.color === 'identity'
              ? identityRunColors(runs, identityColors)
              : ranks
                ? refNameRankBarColors(
                    detail.blocks,
                    runs,
                    ranks,
                    refNameRankPalette,
                  )
                : new Uint32Array(runs.count).fill(
                    cssColorToABGR(value ?? XYPLOT_BAR_COLOR),
                  ),
          )
        : undefined,
    codons,
    codonCells:
      codons && codonProps?.cells
        ? encodeCodonSpans(codons, codonFills(palette.codonFill))
        : undefined,
    conservation:
      codons && codonProps?.band
        ? encodeCodonConservation(codons, codonProps.refRowIndex, bandColor)
        : conservation && detail
          ? encodeConservation(detail.coverage, binBp, bandColor)
          : undefined,
  }
}

function pickSpans(spans: SpanChannels, kept: readonly number[]) {
  const pick = (a: Uint32Array) => Uint32Array.from(kept, i => a[i]!)
  return {
    x: pick(spans.x),
    x2: pick(spans.x2),
    row: pick(spans.row),
    color: typeof spans.color === 'object' ? pick(spans.color) : spans.color,
    count: kept.length,
  }
}

function pickInsertions(
  c: InsertionChannels,
  kept: readonly number[],
): InsertionChannels {
  const pick = (a: Uint32Array) => Uint32Array.from(kept, i => a[i]!)
  return {
    x: pick(c.x),
    x2: pick(c.x2),
    row: pick(c.row),
    length: pick(c.length),
    color: pick(c.color),
    under: c.under && pick(c.under),
    count: kept.length,
  }
}

/**
 * `payload` less the instances no block of its region can show: rows scrolled
 * out of `rows` and spans outside every block's painted bp range. The
 * conservation band sits above the rows, so only the bp range culls it. The SVG
 * export paints this.
 */
export function cullMafRows(
  payload: MafRowsPayload,
  blocks: readonly RenderBlock[],
  canvasWidth: number,
  rows: { firstRow: number; endRow: number },
): MafRowsPayload {
  const rangesWithin = (slackPx?: number) =>
    blocks.flatMap(block => {
      const clip = clipBlockForCanvas(block, canvasWidth)
      return clip ? [paintedBpRange(block, clip, slackPx)] : []
    })
  const ranges = rangesWithin()
  const markerRanges = rangesWithin(WIDEST_MARKER_PX / 2)
  const shownInsertions = (c: InsertionChannels) => {
    const kept: number[] = []
    for (let i = 0; i < c.count; i++) {
      const row = c.row[i]!
      if (
        row >= rows.firstRow &&
        row < rows.endRow &&
        markerRanges.some(r => r.overlaps(c.x[i]!, c.x2[i]! + 1))
      ) {
        kept.push(i)
      }
    }
    return kept
  }
  const shown = (spans: SpanChannels, band = false) => {
    const kept: number[] = []
    for (let i = 0; i < spans.count; i++) {
      const row = spans.row[i]!
      if (
        (band || (row >= rows.firstRow && row < rows.endRow)) &&
        ranges.some(r => r.overlaps(spans.x[i]!, spans.x2[i]!))
      ) {
        kept.push(i)
      }
    }
    return kept
  }
  const pickBars = (bars: MafIdentityBars, kept: readonly number[]) => ({
    ...pickSpans(bars, kept),
    y: Float32Array.from(kept, i => bars.y[i]!),
  })
  const {
    cells,
    refNameRank,
    summary,
    identity,
    identityBars,
    codonCells,
    codons,
    conservation,
    insertions,
  } = payload
  const insertionsKept = insertions && shownInsertions(insertions)
  const summaryKept = summary && shown(summary)
  return {
    codons,
    codonCells: codonCells && pickSpans(codonCells, shown(codonCells)),
    conservation:
      conservation && pickBars(conservation, shown(conservation, true)),
    cells: pickSpans(cells, shown(cells)),
    refNameRank: refNameRank && pickSpans(refNameRank, shown(refNameRank)),
    identity: identity && pickSpans(identity, shown(identity)),
    identityBars: identityBars && pickBars(identityBars, shown(identityBars)),
    summary: summary &&
      summaryKept && {
        ...pickSpans(summary, summaryKept),
        records: summaryKept.map(i => summary.records[i]!),
      },
    insertions:
      insertions &&
      insertionsKept &&
      pickInsertions(insertions, insertionsKept),
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
    frames: ReadonlyMap<number, MafFrameRecord[]>,
  ): ReadonlyMap<number, MafRowsSource> => {
    const next = new Map<number, MafRowsSource>()
    for (const key of new Set([...detail.keys(), ...summary.keys()])) {
      const d = detail.get(key)
      const s = summary.get(key)
      const f = frames.get(key)
      const prev = last.get(key)
      next.set(
        key,
        prev && prev.detail === d && prev.summary === s && prev.frames === f
          ? prev
          : { detail: d, summary: s, frames: f },
      )
    }
    last = next
    return next
  }
}
