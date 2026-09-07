import {
  datasetMayHide,
  offscreenMateAt,
  offscreenMateSpanAt,
} from '../LinearSyntenyDisplay/drawOffscreenMates.ts'
import { offscreenMateMarkColorFor } from './offscreenMateMarkColors.ts'

import type { CulledRibbonMates } from '../LinearSyntenyDisplay/culledRibbonMates.ts'
import type {
  MateBand,
  OffscreenMateDataset,
  OffscreenMateLane,
  OffscreenMateMark,
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

// The structural slice the overlay, the hit tests and the SVG export read, so
// where a mark lands is checkable without a canvas
export interface OffscreenMateSource {
  level: number
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
    views: { bpPerPx: number; offsetPx: number }[]
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

// One strip per band edge that has anything. A level sits between rows
// `level` and `level + 1`: the query row's marks hang off the top edge against
// its own ruler, the target row's off the bottom against its.
export function offscreenMateStrips(
  model: OffscreenMateSource,
): OffscreenMateStrip[] {
  const { parentView, height } = model
  if (!parentView.showOffscreenMates) {
    return []
  }
  const { minAlignmentLength, overdrawPx, width, views } = parentView
  const above = views[model.level]
  const below = views[model.level + 1]
  const sides = [
    {
      side: 'top' as const,
      row: above,
      mateRow: below,
      navRow: model.level + 1,
    },
    {
      side: 'bottom' as const,
      row: below,
      mateRow: above,
      navRow: model.level,
    },
  ]
  return sides.flatMap(({ side, row, mateRow, navRow }) => {
    const mateBand = mateRow
      ? {
          lo: (mateRow.offsetPx - overdrawPx) * mateRow.bpPerPx,
          hi: (mateRow.offsetPx + width + overdrawPx) * mateRow.bpPerPx,
        }
      : undefined
    const datasets = lane(model, side, mateBand)
    return row && datasets.length > 0
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

export interface OffscreenMateHit extends OffscreenMateMark {
  navRow: number
  side: OffscreenMateSide
}

export interface OffscreenMateNavHit extends OffscreenMateSpan {
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
) {
  return stripHit(strips, x, y, offscreenMateAt)
}

// The click's resolver: a full scan of the lane for the span, where the hover
// only needs a name
export function offscreenMateNavHit(
  strips: OffscreenMateStrip[],
  x: number,
  y: number,
) {
  return stripHit(strips, x, y, offscreenMateSpanAt)
}

function stripHit<T>(
  strips: OffscreenMateStrip[],
  x: number,
  y: number,
  ask: (lane: OffscreenMateLane, x: number, y: number) => T | undefined,
) {
  for (const strip of strips) {
    const found = ask(strip, x, y)
    if (found) {
      return { ...found, navRow: strip.navRow, side: strip.side }
    }
  }
  return undefined
}

// How many alignments on this band go to one contig: a property of the band's
// data rather than the current transform, so it counts the ones drawn right
// now and the ones under the length floor too. Which of them are drawable is
// what the mark's presence already says.
export function offscreenMateCount(
  model: OffscreenMateSource,
  refName: string,
  side: OffscreenMateSide,
) {
  let total = 0
  for (const display of model.linearSyntenyDisplays) {
    for (const data of laneData(display, side)) {
      const id = data.mateRefNameDict.indexOf(refName)
      if (id >= 0) {
        total += data.counts[id] ?? 0
      }
    }
  }
  return total
}
