import { coarseStripHTML, max, measureText, sum } from '@jbrowse/core/util'
import { getTrackName } from '@jbrowse/core/util/tracks'

import {
  HEADER_BAR_HEIGHT,
  HEADER_OVERVIEW_HEIGHT,
  SVG_SCALEBAR_CAP,
} from '../consts.ts'

import type { TrackLabelMode } from '../types.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { AbstractSessionModel } from '@jbrowse/core/util'
import type { ReactNode } from 'react'

// Just the per-track heights that the vertical-layout math needs; every track
// shape fed into these helpers (including SvgDisplayResult.track) satisfies it.
interface TrackHeights {
  displays: { height: number }[]
}

// A rendered track body plus the track it came from, as produced by each
// display's `renderSvg`. Shared by SVGTracks/SVGView and by the synteny and
// breakpoint-split exports, which feed the same shape back in.
export interface SvgDisplayResult {
  track: {
    configuration: AnyConfigurationModel
    displays: { height: number }[]
  }
  result: ReactNode
}

export const trackSpacing = 2

// x shift from the staticBlocks frame (which `gridlineTicks`/`scalebarLabels`
// are computed in, and which overhangs the viewport on both sides) into the
// view frame. The on-screen counterpart is ZoomTransform's translateX.
export function staticBlocksDx(model: {
  staticBlocks: { offsetPx: number }
  offsetPx: number
}) {
  return model.staticBlocks.offsetPx - model.offsetPx
}

// Major and minor gridline tick x-positions, shifted from the staticBlocks
// frame into the view frame. Shared by the SVG gridlines and ruler so their
// tick pitch can't drift. `dx` is returned too since the ruler reuses it to
// place its coordinate labels.
export function gridlineTickXs(model: {
  staticBlocks: { offsetPx: number }
  offsetPx: number
  gridlineTicks: { major: boolean; x: number }[]
}) {
  const dx = staticBlocksDx(model)
  const xs = (wantMajor: boolean) =>
    model.gridlineTicks.filter(t => t.major === wantMajor).map(t => dx + t.x)
  return { dx, major: xs(true), minor: xs(false) }
}

// `d` for a run of vertical tick lines, collapsed into one <path> rather than a
// <line> each — as the on-screen Gridlines does. Ticks are anonymous positions
// with no natural React key, and a few hundred of them per export is a lot of
// nodes to spend on that.
export function vlinePath(xs: number[], y1: number, y2: number) {
  return xs.map(x => `M${x} ${y1}V${y2}`).join('')
}

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

// Gap between a 'left' track label's right edge and the track body.
// SVGTrackLabel right-aligns its text at `trackLabelOffset - TRACK_LABEL_GAP`,
// so it and trackLabelLeftOffset must agree or the widest name overflows the
// gutter it was measured for.
export const TRACK_LABEL_GAP = 40

// The name SVGTrackLabel actually draws for a track. HTML in a config's name
// is stripped before measuring, so the reserved gutter matches the glyphs.
export function svgTrackName(
  track: { configuration: AnyConfigurationModel },
  session: AbstractSessionModel,
) {
  return coarseStripHTML(getTrackName(track.configuration, session))
}

// Horizontal gutter reserved for 'left' track labels (0 in every other mode).
// Takes an already-minimized-filtered track list, so the reserved width matches
// the labels that actually get drawn.
export function trackLabelLeftOffset({
  tracks,
  trackLabels,
  fontSize,
  session,
}: {
  tracks: { configuration: AnyConfigurationModel }[]
  trackLabels: TrackLabelMode
  fontSize: number
  session: AbstractSessionModel
}) {
  return trackLabels === 'left'
    ? max(
        tracks.map(t => measureText(svgTrackName(t, session), fontSize)),
        0,
      ) + TRACK_LABEL_GAP
    : 0
}

// vertical box a single track occupies. Shared by totalHeight (sum) and
// SVGTracks.getOffsets (prefix-sum) so the two can't drift.
export function trackBoxHeight(track: TrackHeights, textOffset: number) {
  return track.displays[0]!.height + textOffset + trackSpacing
}

export function totalHeight(
  tracks: TrackHeights[],
  textHeight: number,
  trackLabels: TrackLabelMode,
) {
  const textOffset = labelOffset(trackLabels, textHeight)
  return sum(tracks.map(t => trackBoxHeight(t, textOffset)))
}
