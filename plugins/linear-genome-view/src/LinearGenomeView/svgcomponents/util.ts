import { svgTrackName } from '@jbrowse/core/svg/trackNames'
import { max, measureText, sum } from '@jbrowse/core/util'

import {
  HEADER_BAR_HEIGHT,
  HEADER_OVERVIEW_HEIGHT,
  SVG_SCALEBAR_CAP,
} from '../consts.ts'
import { REF_NAME_LABEL_FONT_SIZE } from '../util.ts'

import type { TrackLabelMode } from '../types.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { TrackCatalog } from '@jbrowse/core/util'
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

// Major and minor gridline tick x-positions, shifted from the staticBlocks
// frame (which `gridlineTicks`/`scalebarLabels` are computed in, and which
// overhangs the viewport on both sides) into the view frame. Shared by the SVG
// gridlines and ruler so their tick pitch can't drift. `dx` is returned too
// since the ruler reuses it to place its coordinate labels.
//
// The shift is the view's own `staticBlocksTranslateX`, so the export and
// ZoomTransform cannot disagree about the frame.
export function gridlineTickXs(model: {
  staticBlocksTranslateX: number
  gridlineTicks: { major: boolean; x: number }[]
}) {
  const dx = model.staticBlocksTranslateX
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

// Vertical ink extents of a text label, as a fraction of its font size: Chrome
// reports a 13px Latin string as 15px tall with ~3px of that below the
// baseline. `fontSize` alone undercounts the box (it ignores the descenders),
// which is what used to let an 'offset' label's descenders land on the first
// pixel row of the track body.
const LABEL_INK_EM = 1.16
const LABEL_DESCENT_EM = 0.22

export function labelInkHeight(fontSize: number) {
  return Math.ceil(fontSize * LABEL_INK_EM)
}

function labelDescent(fontSize: number) {
  return Math.ceil(fontSize * LABEL_DESCENT_EM)
}

/**
 * Baseline y for a label whose ink box should start at `topY` — roughly what
 * `dominantBaseline="hanging"` asks the renderer for, but resolved here.
 *
 * Not a renderer-compatibility workaround (`dominant-baseline` is well
 * supported, and SvgCanvas emits it on every feature label it writes). The
 * point is that this file already *models* the ink box, in LABEL_INK_EM /
 * LABEL_DESCENT_EM, and reserves vertical space from that model —
 * `getHeaderLayout` budgets `labelInkHeight(fontSize)` for the scalebar's bp
 * label, `defaultTextHeight` for an offset track label. A label placed with
 * `hanging` is instead positioned by the renderer's own notion of the font's
 * ascent, so the space reserved and the space used come from two different
 * models that merely happen to agree closely at the sizes we ship. Resolving
 * the baseline from the same constants makes them one model, which is what lets
 * util.test.ts check placement against reservation at all.
 */
export function labelBaselineFromTop(topY: number, fontSize: number) {
  return topY + labelInkHeight(fontSize) - labelDescent(fontSize)
}

// clearance an 'offset' label keeps above its ascenders and below its
// descenders. The bottom gap is the wider of the two: it separates text from
// the features, where the top gap only separates it from the track above.
const LABEL_PAD_TOP = 1
const LABEL_PAD_BOTTOM = 3

// Default `textHeight`: the band an 'offset' label occupies above its track,
// i.e. its full ink box plus that clearance. 20px at the default 13px font,
// where the old fixed 18 left the descenders 0.4px shy of the features.
export function defaultTextHeight(fontSize: number) {
  return labelInkHeight(fontSize) + LABEL_PAD_TOP + LABEL_PAD_BOTTOM
}

// Baseline for an 'offset' label sitting in a `textHeight`-tall band. Measured
// up from the bottom of the band rather than down from the top, so a
// caller-supplied textHeight still clears the features (it eats into the gap
// above the label instead).
export function offsetLabelBaselineY(textHeight: number, fontSize: number) {
  return textHeight - LABEL_PAD_BOTTOM - labelDescent(fontSize)
}

// Baseline for a label inset into the top of the box it draws over ('overlay'
// mode), measured down from that top edge so the ascenders stay inside it.
export function insetLabelBaselineY(fontSize: number) {
  return labelBaselineFromTop(LABEL_PAD_TOP, fontSize)
}

// The same layout for a STACKED row's header (SVGRowHeader), which differs from
// the standalone one in direction: its origin is the top of the ruler, and what
// sits above the ruler is drawn at negative y, into a band the caller reserves
// between this row and the one above. `bandHeight` is that reservation.
//
// A row with no scalebar keeps the layout it has always had — the assembly label
// on the alphabetic baseline at the origin, its ink box in the caller's band —
// so the height of a synteny stack does not move.
//
// With one, the bar and its bp label go between the assembly name and the ruler.
// A stacked export is several loci a reader is asked to compare, and without a
// scale in each row the only thing saying whether two rows are at the same zoom
// is their ruler coordinates, which are unreadable at the size a figure is
// published at. The standalone LGV export has drawn this bar all along.
export function getRowHeaderLayout({
  fontSize,
  showScalebar,
}: {
  fontSize: number
  showScalebar: boolean
}) {
  const label = labelInkHeight(fontSize)
  // the bp label hangs a cap below the bar's line and its own ink box ends a gap
  // above the ruler at y=0
  const scalebarLineY = showScalebar
    ? -(ROW_GAP + label + SVG_SCALEBAR_CAP)
    : undefined
  // the assembly name's ink box ends a gap above the bar's top cap, which is a
  // vertical line at the same x the name starts at. Everything here is placed by
  // ink box rather than by baseline, because the gaps are fixed while a font's
  // descent is not: laying the label out from its baseline instead put its
  // descenders through that cap at the larger export fonts.
  const assemblyInkTop =
    scalebarLineY === undefined
      ? -label
      : scalebarLineY - SVG_SCALEBAR_CAP - ROW_GAP - label
  return {
    // undefined rather than an unused number: a row without a scalebar has no
    // line to place, and the caller draws nothing
    scalebarLineY,
    // 0 is the pre-scalebar placement, kept exactly so a synteny stack doesn't
    // move
    assemblyLabelBaselineY: showScalebar
      ? labelBaselineFromTop(assemblyInkTop, fontSize)
      : 0,
    // up from the ruler to the top of the topmost ink box — the assembly
    // label's, in both cases
    bandHeight: -assemblyInkTop,
  }
}

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
  // the assembly name is drawn on its ink box, not on `fontSize`: at y=0 with a
  // hanging baseline its ascenders rose above the export's top edge and got
  // clipped, so the label now hangs from its own baseline inside this band
  const assemblyLabelHeight = labelInkHeight(fontSize)
  const cytobandTop = assemblyLabelHeight + ROW_GAP
  const polygonTop = cytobandTop + HEADER_OVERVIEW_HEIGHT
  // scalebar line sits at the bottom tip of the "you are here" polygon (with
  // cytobands) or just below the assembly name (without); the cap clears the
  // assembly label in the latter case
  const scalebarLineY = showCytobands
    ? polygonTop + HEADER_BAR_HEIGHT
    : cytobandTop + SVG_SCALEBAR_CAP
  // the bp label hangs below the scalebar line (a cap's clearance, then the
  // label's ink box), and the ruler starts a gap below that
  const rulerTop =
    scalebarLineY + SVG_SCALEBAR_CAP + labelInkHeight(fontSize) + ROW_GAP
  return {
    assemblyLabelBaselineY: labelBaselineFromTop(0, fontSize),
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

// Ink box of the bold refName label drawn at the top of the ruler, keyed to the
// size its glyphs are actually drawn at rather than to the export's general
// `fontSize`. The two are independent: the fit tests upstream (refNameLabelWidth
// via getScalebarRefNameLabels / refNameLabelFitsInView) all measure at
// REF_NAME_LABEL_FONT_SIZE, so sizing the label's clip box off `fontSize`
// instead clipped the descenders of a name like `chrUn_gl000220` at the default
// 13, and both ends of the glyphs at any smaller export font.
export const refNameLabelBoxHeight = labelInkHeight(REF_NAME_LABEL_FONT_SIZE)
export const refNameLabelBaselineY = labelBaselineFromTop(
  0,
  REF_NAME_LABEL_FONT_SIZE,
)

// space the label pushes a track down by; only 'offset' mode does
export function labelOffset(trackLabels: TrackLabelMode, textHeight: number) {
  return trackLabels === 'offset' ? textHeight : 0
}

// Gap between a 'left' track label's right edge and the track body.
// SVGTrackLabel right-aligns its text at `trackLabelOffset - TRACK_LABEL_GAP`,
// so it and trackLabelLeftOffset must agree or the widest name overflows the
// gutter it was measured for.
export const TRACK_LABEL_GAP = 40

// Horizontal gutter reserved for 'left' track labels (0 in every other mode).
// Takes an already-minimized-filtered track list, so the reserved width matches
// the labels that actually get drawn.
//
// `fontFamily` is the export's own font option, and it has to reach the ruler
// here: the labels are drawn in it (wrapSvgExport puts it on the root <svg>,
// where every <text> inherits it), so measuring them in another font reserves
// the wrong gutter — and this is the one measurement whose being wrong shows up
// as ink outside its box rather than as a label dropped at an edge. Monospace
// is the family that breaks it; see measureText.
//
// The export's other fit tests (tickLabelWidth for the ruler coordinates,
// refNameLabelWidth for the chromosome names) still measure at the app font,
// deliberately: they feed *drop* rules whose worst case is a label at the
// viewport edge kept instead of dropped, and every one of them is drawn inside
// a clip that bounds it either way. Their region-fit half also lives in
// `getScalebarRefNameLabels`, an on-screen model getter, so making them
// family-aware means threading an export option through screen state.
export function trackLabelLeftOffset({
  tracks,
  trackLabels,
  fontSize,
  fontFamily,
  session,
}: {
  tracks: { configuration: AnyConfigurationModel }[]
  trackLabels: TrackLabelMode
  fontSize: number
  fontFamily?: string
  session: TrackCatalog
}) {
  return trackLabels === 'left'
    ? max(
        tracks.map(t =>
          measureText(svgTrackName(t, session), fontSize, fontFamily),
        ),
        0,
      ) + TRACK_LABEL_GAP
    : 0
}

// vertical box a single track occupies. Shared by totalHeight (sum) and
// trackBoxOffsets (prefix-sum) so the two can't drift.
export function trackBoxHeight(track: TrackHeights, textOffset: number) {
  return track.displays[0]!.height + textOffset + trackSpacing
}

// Top y of each track's box within a stack of them. SVGTracks lays the bodies
// out with it and the breakpoint-split export anchors its overlay ribbons with
// it, so one implementation rather than two prefix-sums that must agree —
// they drifted by trackSpacing per track when they didn't.
export function trackBoxOffsets(tracks: TrackHeights[], textOffset: number) {
  const offsets: number[] = []
  let total = 0
  for (const track of tracks) {
    offsets.push(total)
    total += trackBoxHeight(track, textOffset)
  }
  return offsets
}

export function totalHeight(
  tracks: TrackHeights[],
  textHeight: number,
  trackLabels: TrackLabelMode,
) {
  const textOffset = labelOffset(trackLabels, textHeight)
  return sum(tracks.map(t => trackBoxHeight(t, textOffset)))
}
