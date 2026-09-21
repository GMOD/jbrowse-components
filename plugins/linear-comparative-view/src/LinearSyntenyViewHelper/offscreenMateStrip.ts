import {
  datasetMayHide,
  offscreenMateAt,
} from '../LinearSyntenyDisplay/drawOffscreenMates.ts'
import { offscreenMateMarkColorFor } from './offscreenMateMarkColors.ts'

import type { CulledRibbonMates } from '../LinearSyntenyDisplay/culledRibbonMates.ts'
import type {
  MateBand,
  OffscreenMateDataset,
  OffscreenMateLane,
  OffscreenMateSide,
  OffscreenMateSpan,
} from '../LinearSyntenyDisplay/drawOffscreenMates.ts'
import type { OffscreenMateData } from '../LinearSyntenyRPC/collectOffscreenMates.ts'
import type { MarkColorDisplay } from './offscreenMateMarkColors.ts'

export interface OffscreenMateStrip extends OffscreenMateLane {
  // the row a click on one of these marks navigates: the one not displaying
  // the contig the mark names
  navRow: number
}

interface StripRow {
  bpPerPx: number
  offsetPx: number
}

// The structural slice the overlay, the hit tests and the SVG export read, so
// where a mark lands is checkable without a canvas
export interface OffscreenMateSource {
  level: number
  rowPair: { v0: StripRow; v1: StripRow } | undefined
  height: number
  linearSyntenyDisplays: (MarkColorDisplay & {
    featureData?: {
      offscreenMates: OffscreenMateData
      targetOffscreenMates?: OffscreenMateData
      targetQueried?: boolean
    }
    culledRibbonMates?: CulledRibbonMates
  })[]
  parentView: {
    showOffscreenMates: boolean
    minAlignmentLength: number
    overdrawPx: number
    width: number
  }
}

type SourceDisplay = OffscreenMateSource['linearSyntenyDisplays'][number]

// A row gets a strip only if the file was queried from it. The upper row
// always is. From a single fetch the lower row's culled lane holds only what
// fell inside the upper row's pan buffer, so its marks would stop at the fetch
// window rather than at the data and its counts would be a fraction; the lane
// waits for a payload that queried that row. The two sides hold contigs of
// different assemblies, so a side is named by every reader.
function laneData(
  display: SourceDisplay,
  side: OffscreenMateSide,
): OffscreenMateDataset[] {
  const { featureData, culledRibbonMates } = display
  const lanes =
    side === 'top'
      ? [featureData?.offscreenMates, culledRibbonMates?.onQueryAxis]
      : featureData?.targetQueried
        ? [featureData.targetOffscreenMates, culledRibbonMates?.onTargetAxis]
        : []
  return lanes.filter(lane => lane !== undefined)
}

function lane(
  model: OffscreenMateSource,
  side: OffscreenMateSide,
  band: MateBand | undefined,
) {
  const out: OffscreenMateDataset[] = []
  for (const display of model.linearSyntenyDisplays) {
    for (const data of laneData(display, side)) {
      if (data.starts.length > 0 && datasetMayHide(data, band)) {
        out.push(data)
      }
    }
  }
  return out
}

// One strip per band edge that has anything: the query row's marks hang off the
// top edge against its own ruler, the target row's off the bottom against its.
export function offscreenMateStrips(
  model: OffscreenMateSource,
): OffscreenMateStrip[] {
  const { parentView, height, rowPair, level } = model
  if (!parentView.showOffscreenMates || !rowPair) {
    return []
  }
  const { minAlignmentLength, overdrawPx, width } = parentView
  const { v0, v1 } = rowPair
  const sides = [
    { side: 'top' as const, row: v0, mateRow: v1, navRow: level + 1 },
    { side: 'bottom' as const, row: v1, mateRow: v0, navRow: level },
  ]
  return sides.flatMap(({ side, row, mateRow, navRow }) => {
    const mateBand = {
      lo: (mateRow.offsetPx - overdrawPx) * mateRow.bpPerPx,
      hi: (mateRow.offsetPx + width + overdrawPx) * mateRow.bpPerPx,
    }
    const datasets = lane(model, side, mateBand)
    return datasets.length > 0
      ? [
          {
            datasets,
            mateBand,
            bpPerPx: row.bpPerPx,
            offsetPx: row.offsetPx,
            minAlignmentLength,
            side,
            navRow,
            markColorFor: offscreenMateMarkColorFor(
              model.linearSyntenyDisplays,
              side,
            ),
            width,
            height,
          },
        ]
      : []
  })
}

export interface OffscreenMateHit extends OffscreenMateSpan {
  navRow: number
  side: OffscreenMateSide
}

// Asked by the level's own pointer handlers before the ribbon pick, in the
// few pixels the marks occupy. The two strips hang off opposite edges, so a y
// is inside at most one of them.
export function offscreenMateHit(
  strips: OffscreenMateStrip[],
  x: number,
  y: number,
): OffscreenMateHit | undefined {
  for (const strip of strips) {
    const found = offscreenMateAt(strip, x, y)
    if (found) {
      return { ...found, navRow: strip.navRow, side: strip.side }
    }
  }
  return undefined
}

// What this band sends to one contig, in sequence and in alignments: a property
// of the band's data rather than the current transform, so it holds the ones
// drawn right now and the ones under the length floor too. Which of them are
// drawable is what the mark's presence already says. Both numbers are per
// contig in the lane, so the hover reads them rather than walking the marks.
export function offscreenMateTotals(
  model: OffscreenMateSource,
  refName: string,
  side: OffscreenMateSide,
) {
  let alignments = 0
  let alignedBp = 0
  for (const display of model.linearSyntenyDisplays) {
    for (const data of laneData(display, side)) {
      const id = data.mateRefNameDict.indexOf(refName)
      if (id >= 0) {
        alignments += data.counts[id] ?? 0
        alignedBp += data.alignedBp[id] ?? 0
      }
    }
  }
  return { alignments, alignedBp }
}
