import {
  offscreenMateAt,
  offscreenMateSpanAt,
} from '../LinearSyntenyDisplay/drawOffscreenMates.ts'
import { offscreenMateMarkColorFor } from './offscreenMateMarkColors.ts'

import type {
  OffscreenMateLane,
  OffscreenMateLayout,
  OffscreenMateSide,
} from '../LinearSyntenyDisplay/drawOffscreenMates.ts'
import type { OffscreenMateData } from '../LinearSyntenyRPC/collectOffscreenMates.ts'
import type { MarkColorSource } from './offscreenMateMarkColors.ts'
import type { SyntenyColorBy } from '@jbrowse/synteny-core'

// One row of marks: the off-screen mates every display on the level fetched for
// one axis, and the ruler to place them against — plus the one thing the draw
// has no use for and the pointer does.
export interface OffscreenMateStrip extends OffscreenMateLane {
  // The row a click on one of these marks navigates: the one NOT displaying the
  // contig the mark names, which is the row on the far side of the band from the
  // ruler the mark was placed against.
  navRow: number
}

// The structural slice the overlay and the SVG export read, so what decides
// where a mark lands is checkable without a canvas — which jsdom does not give
// one of anyway.
export interface OffscreenMateSource extends MarkColorSource {
  level: number
  linearSyntenyDisplays: {
    featureData?: {
      offscreenMates: OffscreenMateData
      // absent on a duck that predates the second fetch, and empty whenever the
      // view has not asked for one
      targetOffscreenMates?: OffscreenMateData
    }
    // what the ribbons beside these marks are keyed by, which is what decides
    // whether a mark may be colored by the contig it names
    effectiveColorBy?: SyntenyColorBy
    paintedChromosomeOrder?: readonly string[]
  }[]
  parentView: {
    showOffscreenMates: boolean
    minAlignmentLength: number
    views: { bpPerPx: number; offsetPx: number }[]
  }
}

// Which of a display's two lanes a side names. One place says so, because a hit
// reports the side it was found on and the tally it is then counted against has
// to be the lane that answered — the two hold contigs of DIFFERENT assemblies.
function laneData(
  display: OffscreenMateSource['linearSyntenyDisplays'][number],
  side: OffscreenMateSide,
) {
  const { featureData } = display
  return side === 'top'
    ? featureData?.offscreenMates
    : featureData?.targetOffscreenMates
}

// One lane across every display on the level: they paint one strip, so the
// label placement and the "on top" the pointer answers with have to run across
// all of them at once. A dataset with nothing placed is dropped here rather than
// carried, so "has a strip" is one question rather than two.
function lane(model: OffscreenMateSource, side: OffscreenMateSide) {
  const out: OffscreenMateData[] = []
  for (const display of model.linearSyntenyDisplays) {
    const data = laneData(display, side)
    if (data && data.starts.length > 0) {
      out.push(data)
    }
  }
  return out
}

/**
 * What this level has to mark and the rulers to mark it against — one strip per
 * axis that has anything, so neither surface mounts a layer for an empty band.
 *
 * EACH AXIS OWNS ITS OWN STRIP, and the level's index is what tells them apart.
 * A synteny level sits between rows `level` and `level + 1`. The query row's
 * off-screen mates have no position on the row below — that is what they are —
 * so they hang off the top edge against `views[level]`; the target row's are the
 * mirror, arriving only from the second fetch, and hang off the bottom against
 * `views[level + 1]`. Reading one against the other's ruler would draw every
 * mark at a plausible-looking wrong offset that nothing else in the view
 * disagrees with.
 */
export function offscreenMateStrips(
  model: OffscreenMateSource,
): OffscreenMateStrip[] {
  const { parentView } = model
  if (!parentView.showOffscreenMates) {
    return []
  }
  const { minAlignmentLength, views } = parentView
  const sides = [
    { side: 'top' as const, row: views[model.level], navRow: model.level + 1 },
    {
      side: 'bottom' as const,
      row: views[model.level + 1],
      navRow: model.level,
    },
  ]
  return sides.flatMap(({ side, row, navRow }) => {
    const datasets = lane(model, side)
    return row && datasets.length > 0
      ? [
          {
            datasets,
            bpPerPx: row.bpPerPx,
            offsetPx: row.offsetPx,
            minAlignmentLength,
            side,
            navRow,
            markColorFor: offscreenMateMarkColorFor(model, side),
          },
        ]
      : []
  })
}

// The mark under the pointer, as the level reports it: the contig it points at,
// the row that would have to show that contig for these to be ribbons, and
// which strip answered — the last because the two lanes hold contigs of
// DIFFERENT assemblies, so a name alone does not say which tally it came from.
export interface OffscreenMateHit {
  refName: string
  navRow: number
  side: OffscreenMateSide
}

// What a CLICK on a mark resolves to: the same hit, plus where on that contig
// the alignments under the pointer land, in its own bp — which is what lets the
// navigation land on the locus rather than on the whole chromosome.
export interface OffscreenMateNavHit extends OffscreenMateHit {
  start: number
  end: number
}

/**
 * The mark a pointer in either strip is over, or undefined.
 *
 * ASKED BY THE LEVEL'S OWN HANDLERS, before the ribbon pick, and answered only
 * in the few pixels the marks occupy — which sit above and below where any
 * ribbon is drawn, so the pick engine loses nothing. The overlay stays
 * `pointerEvents: none` and does not answer this itself: two hit paths over one
 * band is how a click comes to mean different things depending on which element
 * happened to receive it.
 *
 * The two strips cannot both answer: they hang off opposite edges of the band,
 * so a y is inside at most one of them.
 */
export function offscreenMateHit(
  model: OffscreenMateSource & {
    height: number
    parentView: { width: number }
  },
  x: number,
  y: number,
): OffscreenMateHit | undefined {
  return stripHit(model, x, y, (layout, px, py) => {
    const refName = offscreenMateAt(layout, px, py)
    return refName ? { refName } : undefined
  })
}

/**
 * The same mark, resolved for a CLICK: which contig, and where on it.
 *
 * SEPARATE FROM THE HOVER's, because the span is a full scan of the lane while
 * `offscreenMateAt` exits at the first mark it finds. The hover runs on a
 * rAF per pointer move over a band that may hold tens of thousands of marks;
 * the click runs once, and is the only one of the two that needs coordinates.
 */
export function offscreenMateNavHit(
  model: OffscreenMateSource & {
    height: number
    parentView: { width: number }
  },
  x: number,
  y: number,
): OffscreenMateNavHit | undefined {
  return stripHit(model, x, y, offscreenMateSpanAt)
}

// The half both hit tests share: which strip answers, and the row a click on it
// navigates. Only what is asked of the strip differs.
function stripHit<T>(
  model: OffscreenMateSource & {
    height: number
    parentView: { width: number }
  },
  x: number,
  y: number,
  ask: (layout: OffscreenMateLayout, x: number, y: number) => T | undefined,
) {
  const width = model.parentView.width
  for (const strip of offscreenMateStrips(model)) {
    const found = ask({ ...strip, width, height: model.height }, x, y)
    if (found) {
      return { ...found, navRow: strip.navRow, side: strip.side }
    }
  }
  return undefined
}

/**
 * How many alignments on this band go to one contig.
 *
 * The tally's own number, so the hover and the menu item that reports the same
 * contig cannot disagree: it counts every alignment pointed at that contig,
 * INCLUDING the ones with no place on an axis to draw a mark for. Scoped to this
 * band rather than the view, because the band is what the pointer is over — the
 * menu sums the levels instead.
 *
 * ONE LANE, NAMED BY THE CALLER, because the two hold contigs of DIFFERENT
 * assemblies and a refName does not say which. Summing both looks harmless
 * until the two rows are haplotypes of one genome — the case this whole view is
 * most used for — where both spell a contig `chr1`, and a mark on the lower
 * strip then reports its own count plus the upper strip's.
 */
export function offscreenMateCount(
  model: OffscreenMateSource,
  refName: string,
  side: OffscreenMateSide,
) {
  let total = 0
  for (const display of model.linearSyntenyDisplays) {
    const data = laneData(display, side)
    const id = data?.mateRefNameDict.indexOf(refName) ?? -1
    if (data && id >= 0) {
      total += data.counts[id] ?? 0
    }
  }
  return total
}
