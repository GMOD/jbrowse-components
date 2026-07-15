import { sum } from '@jbrowse/core/util'

import {
  HEADER_BAR_HEIGHT,
  HEADER_OVERVIEW_HEIGHT,
  SVG_SCALEBAR_CAP,
} from '../consts.ts'

import type { TrackLabelMode } from '../types.ts'

interface Display {
  height: number
}
interface Track {
  displays: Display[]
}

export const trackSpacing = 2

// Vertical gap between stacked header rows.
const ROW_GAP = 4

// Compact vertical layout for the exported header: rows (assembly name,
// cytoband overview, "you are here" polygon, total-bp scalebar, ruler) are
// stacked with a small fixed gap rather than reserving loose fixed-height
// bands, so nothing is separated by dead space. `tracksTop` is where the track
// bodies begin (renderToSvg's `offset`). Shared by SVGHeader and renderToSvg so
// the header height and the track origin can't drift.
export function getHeaderLayout({
  fontSize,
  showCytobands,
  rulerHeight,
}: {
  fontSize: number
  showCytobands: boolean
  rulerHeight: number
}) {
  const cytobandTop = fontSize + ROW_GAP
  const polygonTop = cytobandTop + HEADER_OVERVIEW_HEIGHT
  // scalebar line sits at the bottom tip of the "you are here" polygon (with
  // cytobands) or just below the assembly name (without); the cap clears the
  // assembly label in the latter case
  const scalebarLineY = showCytobands
    ? polygonTop + HEADER_BAR_HEIGHT
    : fontSize + ROW_GAP + SVG_SCALEBAR_CAP
  // the bp label hangs below the scalebar line (a cap's clearance, then a
  // fontSize-tall label), and the ruler starts a gap below that
  const rulerTop = scalebarLineY + SVG_SCALEBAR_CAP + fontSize + ROW_GAP
  return {
    cytobandTop,
    scalebarLineY,
    rulerTop,
    tracksTop: rulerTop + rulerHeight,
  }
}

// Ruler tick geometry, shared by the tick marks and their number labels.
export const RULER_MAJOR_TICK = 5
export const RULER_MINOR_TICK = 3
export const RULER_TICK_FONT_SIZE = 11
// clearance between the tick-number baseline and the marks below it
const RULER_TICK_LABEL_GAP = 2

// Vertical positions within a ruler of the given budget: tick marks hang just
// above the tracks (bottom of the budget) and the numbers sit above the marks,
// so the two never overprint.
export function getRulerLayout(rulerHeight: number) {
  const tickTopY = rulerHeight - 2 - RULER_MAJOR_TICK
  return { tickTopY, numbersBaselineY: tickTopY - RULER_TICK_LABEL_GAP }
}

// space the label pushes a track down by; only 'offset' mode does
export function labelOffset(trackLabels: TrackLabelMode, textHeight: number) {
  return trackLabels === 'offset' ? textHeight : 0
}

// vertical box a single track occupies. Shared by totalHeight (sum) and
// SVGTracks.getOffsets (prefix-sum) so the two can't drift.
export function trackBoxHeight(track: Track, textOffset: number) {
  return track.displays[0]!.height + textOffset + trackSpacing
}

export function totalHeight(
  tracks: Track[],
  textHeight: number,
  trackLabels: TrackLabelMode,
) {
  const textOffset = labelOffset(trackLabels, textHeight)
  return sum(tracks.map(t => trackBoxHeight(t, textOffset)))
}
