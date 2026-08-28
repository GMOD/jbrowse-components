import {
  offscreenMateAt,
  offscreenMateSpanAt,
} from '../LinearSyntenyDisplay/drawOffscreenMates.ts'
import { offscreenMateMarkColorFor } from './offscreenMateMarkColors.ts'

import type { CulledRibbonMates } from '../LinearSyntenyDisplay/culledRibbonMates.ts'
import type {
  OffscreenMateDataset,
  OffscreenMateLane,
  OffscreenMateLayout,
  OffscreenMateSide,
  OffscreenMateSpan,
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
    // The alignments whose facing contig the other row IS displaying and has
    // scrolled off, which is a question about the current transform rather than
    // about the fetch — see `culledRibbonMates`. One perspective per row, since
    // an alignment can be off screen on either end. Undefined while the setting
    // is off, so the pass that builds it is not run for a strip nothing draws.
    culledRibbonMates?: CulledRibbonMates
    // what the ribbons beside these marks are keyed by, which is what decides
    // whether a mark may be colored by the contig it names
    effectiveColorBy?: SyntenyColorBy
    paintedChromosomeOrder?: readonly string[]
  }[]
  parentView: {
    showOffscreenMates: boolean
    // whether the LOWER row was queried too, which is what decides whether it
    // gets a strip at all — see `laneData`
    bidirectionalFetch: boolean
    minAlignmentLength: number
    // the band the ribbons are culled against, which is the edge a mark stands
    // in for — one number, so the two cannot come apart
    overdrawPx: number
    width: number
    views: { bpPerPx: number; offsetPx: number }[]
  }
}

// Which of a display's lanes a side names. One place says so, because a hit
// reports the side it was found on and the tally it is then counted against has
// to be the lane that answered — the two SIDES hold contigs of DIFFERENT
// assemblies. Within a side the two datasets hold contigs of the same one, and
// are disjoint: an alignment the worker never decorated has no geometry to be
// culled, and one it did is not in the worker's tally.
//
// A ROW GETS A STRIP ONLY IF IT WAS QUERIED, which is the whole of why a fetch
// input is read here. The upper row always is, so both its lanes are complete:
// every alignment anchored in its visible window came back, whether its mate
// then had no place on the facing axis (the worker's lane) or a place that has
// scrolled off it (the culled lane). The lower row's lanes are the mirror and
// are NOT complete without the second query — a culled alignment placed on the
// target axis is one whose query end is off the row above, so the only ones the
// single fetch holds are those inside `syntenyPanBufferPx`. That margin is a
// CACHE boundary: the marks stop where the fetch window ends rather than where
// the data does, they step on the snap grid as the upper row pans, and the count
// a mark's tooltip prints is then a fraction of the alignments that go there
// with nothing saying so. A number no reader can act on is worse than an empty
// strip, so the lane waits for the query that completes it.
function laneData(
  model: OffscreenMateSource,
  display: OffscreenMateSource['linearSyntenyDisplays'][number],
  side: OffscreenMateSide,
): OffscreenMateDataset[] {
  const { featureData, culledRibbonMates } = display
  const lanes =
    side === 'top'
      ? [featureData?.offscreenMates, culledRibbonMates?.onQueryAxis]
      : model.parentView.bidirectionalFetch
        ? [featureData?.targetOffscreenMates, culledRibbonMates?.onTargetAxis]
        : []
  // A lane the fetch has not produced yet is absent rather than empty, and both
  // readers wanted the same thing from it — dropped here so neither restates it
  return lanes.filter(lane => lane !== undefined)
}

// Nothing this dataset holds can be off the facing axis, so the strip need not
// walk it at all. The common state by a wide margin — two rows zoomed out over
// each other hide nothing — and the whole of what keeps the per-frame half of
// `culledRibbonMates` free there.
//
// A dataset with no mate positions is unconditional: the worker found its
// entries no place on that axis, so no band can put them back. One with mate
// positions and NO band is the opposite — there is no facing row to have
// scrolled away — and marks nothing.
function mayHide(
  data: OffscreenMateDataset,
  band: { lo: number; hi: number } | undefined,
) {
  const { mateAxis } = data
  return mateAxis === undefined
    ? true
    : band !== undefined && (mateAxis.lo < band.lo || mateAxis.hi > band.hi)
}

// One lane across every display on the level: they paint one strip, so the
// label placement and the "on top" the pointer answers with have to run across
// all of them at once. A dataset with nothing placed is dropped here rather than
// carried, so "has a strip" is one question rather than two.
function lane(
  model: OffscreenMateSource,
  side: OffscreenMateSide,
  band: { lo: number; hi: number } | undefined,
) {
  const out: OffscreenMateDataset[] = []
  for (const display of model.linearSyntenyDisplays) {
    for (const data of laneData(model, display, side)) {
      if (data.starts.length > 0 && mayHide(data, band)) {
        out.push(data)
      }
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
 * mirror and hang off the bottom against `views[level + 1]`. Reading one against
 * the other's ruler would draw every mark at a plausible-looking wrong offset
 * that nothing else in the view disagrees with.
 */
export function offscreenMateStrips(
  model: OffscreenMateSource,
): OffscreenMateStrip[] {
  const { parentView } = model
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
    // The facing row's own overdraw band, in its cumBp. Absent when that row is
    // not there — the level is being built, or this is the last one — and then
    // a dataset that knows where its mates are draws nothing, which is the
    // honest answer: there is no axis to have scrolled off. The lane's other
    // datasets are unaffected; theirs is not a question about that row.
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
// the alignments under the pointer land and whether that row is already showing
// it — which is what lets the navigation land on the locus rather than on the
// whole chromosome, and scroll rather than replace. `OffscreenMateSpan` says why
// the two travel together.

export interface OffscreenMateNavHit
  extends OffscreenMateHit, Omit<OffscreenMateSpan, 'refName'> {}

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
 * A PROPERTY OF THE BAND'S DATA, NOT OF THE CURRENT TRANSFORM, which is what
 * lets the two classes of dataset be summed into one number. It counts every
 * alignment this band holds pointed at that contig — the ones with no place on
 * the facing axis at all, the ones with a place the row has scrolled off, and
 * (for a `mateAxis` dataset) the ones whose ribbon is on screen right now. All
 * three are "alignments here that go there", which is the sentence the tooltip
 * prints; which of them are drawable is what the mark under the pointer already
 * says. Counting only the currently-hidden ones would be a full walk of the lane
 * per pointer move — 15ms at 100k features, see
 * `agent-docs/measurements/culled-ribbon-mates.json` — to answer a question the
 * mark's presence answers for free.
 *
 * `minAlignmentLength` is not applied either, by the same rule rather than by
 * oversight: the floor decides which alignments are worth DRAWING, and the ones
 * it hides still go to that contig. It is a fourth way the count exceeds the
 * marks beside it, and the only one the reader set themselves.
 *
 * Scoped to this band rather than the view, because the band is what the pointer
 * is over.
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
    for (const data of laneData(model, display, side)) {
      const id = data.mateRefNameDict.indexOf(refName)
      if (id >= 0) {
        total += data.counts[id] ?? 0
      }
    }
  }
  return total
}
