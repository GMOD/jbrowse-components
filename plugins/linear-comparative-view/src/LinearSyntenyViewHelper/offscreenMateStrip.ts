import { offscreenMateAt } from '../LinearSyntenyDisplay/drawOffscreenMates.ts'

import type { OffscreenMateSide } from '../LinearSyntenyDisplay/drawOffscreenMates.ts'
import type { OffscreenMateData } from '../LinearSyntenyRPC/collectOffscreenMates.ts'

// One row of marks: the off-screen mates every display on the level fetched for
// one axis, and the ruler to place them against.
export interface OffscreenMateStrip {
  datasets: OffscreenMateData[]
  bpPerPx: number
  offsetPx: number
  minAlignmentLength: number
  side: OffscreenMateSide
  // The row a click on one of these marks navigates: the one NOT displaying the
  // contig the mark names, which is the row on the far side of the band from the
  // ruler the mark was placed against.
  navRow: number
}

// The structural slice the overlay and the SVG export read, so what decides
// where a mark lands is checkable without a canvas — which jsdom does not give
// one of anyway.
export interface OffscreenMateSource {
  level: number
  linearSyntenyDisplays: {
    featureData?: {
      offscreenMates: OffscreenMateData
      // absent on a duck that predates the second fetch, and empty whenever the
      // view has not asked for one
      targetOffscreenMates?: OffscreenMateData
    }
  }[]
  parentView: {
    showOffscreenMates: boolean
    minAlignmentLength: number
    views: { bpPerPx: number; offsetPx: number }[]
  }
}

type FeatureDataOf = NonNullable<
  OffscreenMateSource['linearSyntenyDisplays'][number]['featureData']
>

// One lane across every display on the level: they paint one strip, so the
// label placement and the "on top" the pointer answers with have to run across
// all of them at once.
function lane(
  model: OffscreenMateSource,
  pick: (data: FeatureDataOf) => OffscreenMateData | undefined,
) {
  return model.linearSyntenyDisplays
    .map(d => (d.featureData ? pick(d.featureData) : undefined))
    .filter(data => data !== undefined)
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
  const lanes = [
    {
      row: views[model.level],
      datasets: lane(model, d => d.offscreenMates),
      side: 'top' as const,
      navRow: model.level + 1,
    },
    {
      row: views[model.level + 1],
      datasets: lane(model, d => d.targetOffscreenMates),
      side: 'bottom' as const,
      navRow: model.level,
    },
  ]
  return lanes.flatMap(({ row, datasets, side, navRow }) => {
    const drawable = datasets.filter(data => data.starts.length > 0)
    return row && drawable.length > 0
      ? [
          {
            datasets: drawable,
            bpPerPx: row.bpPerPx,
            offsetPx: row.offsetPx,
            minAlignmentLength,
            side,
            navRow,
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
  const width = model.parentView.width
  for (const strip of offscreenMateStrips(model)) {
    const hit = offscreenMateAt({ ...strip, width, height: model.height }, x, y)
    if (hit) {
      return { refName: hit.refName, navRow: strip.navRow, side: strip.side }
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
  side: OffscreenMateSide = 'top',
) {
  let total = 0
  for (const d of model.linearSyntenyDisplays) {
    const data =
      side === 'top'
        ? d.featureData?.offscreenMates
        : d.featureData?.targetOffscreenMates
    const id = data?.mateRefNameDict.indexOf(refName) ?? -1
    if (data && id >= 0) {
      total += data.counts[id] ?? 0
    }
  }
  return total
}
