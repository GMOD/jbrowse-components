import { MIN_BAND_HEIGHT } from '@jbrowse/core/util/bandHeight'
import {
  boundStackedBands,
  dragBandHeight,
  fillStackedBands,
  reservedPx,
  stackBands,
} from '@jbrowse/core/util/bandLayout'
import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/wiggle-core/constants'

import { bandScreenTop, contentScreenY } from './components/sectionScreen.ts'

import type { ScrollModel } from './components/sectionScreen.ts'
import type { ReadConnectionsMode } from './constants.ts'
import type { ArcBand, SectionRender } from './renderers/rendererTypes.ts'
import type { Band, BandPlot, BandStack } from '@jbrowse/core/util/bandLayout'

// This display's band order, stated once: what a section reserves above its
// pileup, top to bottom, named as the config objects that size them.
export const LANE_BAND_ORDER = [
  'coverage',
  'readConnections',
  'sashimi',
] as const
export type LaneBandKey = (typeof LANE_BAND_ORDER)[number]

const SASHIMI_ABOVE_BAND_ORDER: readonly LaneBandKey[] = [
  'sashimi',
  'coverage',
  'readConnections',
]
const READ_CONNECTIONS_ABOVE_BAND_ORDER: readonly LaneBandKey[] = [
  'readConnections',
  'coverage',
  'sashimi',
]
const BOTH_ABOVE_BAND_ORDER: readonly LaneBandKey[] = [
  'readConnections',
  'sashimi',
  'coverage',
]

/**
 * A lane's bands top to bottom. A strip placed `above` stacks before the
 * coverage band; with both there the read connections lead, as they do below
 * it, which leaves the junctions' feet on the coverage they explain.
 */
export function laneBandOrder(s: {
  readConnectionsAbove: boolean
  sashimiAbove: boolean
}) {
  return s.readConnectionsAbove
    ? s.sashimiAbove
      ? BOTH_ABOVE_BAND_ORDER
      : READ_CONNECTIONS_ABOVE_BAND_ORDER
    : s.sashimiAbove
      ? SASHIMI_ABOVE_BAND_ORDER
      : LANE_BAND_ORDER
}

/** Whether band `key` stacks before the coverage band. */
export function bandAboveCoverage(
  stack: BandStack<LaneBandKey>,
  key: LaneBandKey,
) {
  return stack.order.indexOf(key) < stack.order.indexOf('coverage')
}

/** Content-space y of a section's coverage band, below any band stacked before it. */
export function coverageBandTop(
  section: Pick<Section, 'sectionTop' | 'bands'>,
) {
  return section.sectionTop + section.bands.top.coverage
}

// The strips beside the coverage histogram, which keep their stated heights
// while the pileup is hidden, the coverage taking the rest of the slot.
const STRIP_ORDER = ['readConnections', 'sashimi'] as const
export type StripKey = (typeof STRIP_ORDER)[number]

// The geometry of one stacked lane, in content space. The lane's own identity
// and data ride beside it on `LaneSection`.
export interface Section {
  // Where the section starts, which is its first band's top: the coverage
  // band's is `coverageBandTop`.
  sectionTop: number
  // The lane's band stack above its pileup (`laneBands`), its tops relative
  // to `sectionTop`. A band reserving 0 px has no strip, so it draws nothing
  // and gets no handle.
  bands: BandStack<LaneBandKey>
  // Where the read connections DRAW, which is not the same question as what
  // `bands` reserves for them: overlay arcs reserve nothing and draw over the
  // coverage histogram. Undefined where they draw nothing.
  arcBand: ArcBand | undefined
  pileupTop: number
  // The laid-out rows, or the height a drag pinned this lane at when that is
  // taller (the surplus draws blank, like a track dragged past its content).
  pileupHeight: number
  // The laid-out rows alone, the band the dip law sizes a discordant dip to
  // (`discordantDipPx`), so a drag padding the band deepens no curve.
  rowsHeight: number
  // The whole strip this section owns, down to the next section's top:
  // carried because the label-chip pad belongs to it, and re-deriving it from
  // the next section put a group's name over the next.
  height: number
}

// Each lane with its geometry spread on, in stacking order.
export interface SectionsLayout<L = unknown> {
  sections: (L & Section)[]
  contentHeight: number
}

// What a lane tells the stacking about itself.
export interface SectionLaneInput {
  maxY: number
  // Whether this lane's arcs draw anything at all (`inkGroupKeys`), cross-region
  // arcs included. A lane with none reserves no strip and gets no draw band.
  hasArcs: boolean
  // Whether a junction is bound for this lane's sashimi strip.
  hasSashimiStripArcs: boolean
  // Height a drag pinned this lane's pileup band at. Only ever pads, and only a
  // lane that draws rows at all, which keeps a collapsed lane's banked
  // override from reopening its band.
  heightOverridePx: number | undefined
}

// How far the band bottom a section's resize handle sits on travels per px of a
// DISPLAY-GLOBAL band height: its own band, plus every band of that kind stacked
// above it, since those grow by the same px and push it down. Dividing a drag by
// it keeps the handle under the pointer.
export function stackedBandGain(
  sections: readonly Pick<Section, 'bands'>[],
  index: number,
  key: LaneBandKey,
) {
  let gain = 1
  for (const section of sections.slice(0, index)) {
    if (section.bands.reserved[key] > 0) {
      gain += 1
    }
  }
  return gain
}

/** Content-space y of band `key`'s bottom seam in a section. */
export function laneBandBottom(
  section: Pick<Section, 'sectionTop' | 'bands'>,
  key: LaneBandKey,
) {
  const { top, reserved } = section.bands
  return section.sectionTop + top[key] + reserved[key]
}

/**
 * Where band `key`'s resize handle sits in section `index`, how it is geared
 * (`stackedBandGain`), and whether a drag down lowers the height, or
 * undefined where the band has none. A band reserving no px has none. With
 * the pileup shown the handle sits on the band's bottom seam. With it hidden
 * the coverage takes what the strips leave of each slot, so it has no handle,
 * and a strip's sits on the seam it shares with the coverage: its top seam
 * below the coverage, where dragging up grows it, and its bottom seam above
 * it, where dragging down does. Slots never move, so it moves 1 px per px.
 */
export function laneBandHandle(
  sections: readonly Pick<Section, 'sectionTop' | 'bands'>[],
  index: number,
  key: LaneBandKey,
  showPileup: boolean,
) {
  const section = sections[index]!
  const { top, reserved } = section.bands
  return reserved[key] > 0
    ? showPileup
      ? {
          seam: laneBandBottom(section, key),
          gain: stackedBandGain(sections, index, key),
          reverse: false,
        }
      : key !== 'coverage' && reserved.coverage > 0
        ? bandAboveCoverage(section.bands, key)
          ? { seam: laneBandBottom(section, key), gain: 1, reverse: false }
          : { seam: section.sectionTop + top[key], gain: 1, reverse: true }
        : undefined
    : undefined
}

// The settings half of every lane's band stack: whether each strip MAY be
// reserved and how tall, with neither data half answered.
export interface LaneBandsSettings {
  showCoverage: boolean
  coverageHeight: number
  drawnReadConnections: ReadConnectionsMode
  // The arcs hang from their strip's top (`placement: 'below'`).
  readConnectionsDown: boolean
  // The strip stacks above the coverage band, its arcs rising from its floor
  // (`placement: 'above'`).
  readConnectionsAbove: boolean
  readConnectionsHeight: number
  showSashimi: boolean
  sashimiAbove: boolean
  sashimiHeight: number
}

// What a lane's data says about its strips, the half of the reserve rule the
// settings cannot answer.
export interface LaneBandData {
  hasArcs: boolean
  hasSashimiStripArcs: boolean
}

export type LaneBandsInput = LaneBandsSettings & LaneBandData

// The px each band of a lane's stack is drawn at.
export interface LaneBandHeights {
  coverageHeight: number
  readConnectionsHeight: number
  sashimiHeight: number
}

export interface LaneBands {
  // The fold, tops relative to the lane's top; `bottom` is where the pileup
  // begins.
  stack: BandStack<LaneBandKey>
  // Where the read connections draw, relative to the lane's top, or undefined
  // where they draw nothing.
  arcBand: ArcBand | undefined
}

// Overlay arcs draw on the coverage histogram, so their zero anchor is its
// BASELINE, the scalebar inset above the band bottom. Floored here: a stated
// coverage height below the inset is an honored state.
function coverageOverlayBand(stack: BandStack<LaneBandKey>) {
  return {
    top: stack.top.coverage,
    height: Math.max(0, stack.reserved.coverage - YSCALEBAR_LABEL_OFFSET),
    down: false,
  }
}

// Arcs placed below or above the coverage always take a strip of their own;
// overlay arcs draw on the coverage histogram when there is one to overlay,
// and take a strip of their own otherwise. Either strip is active only for a
// lane with something to put in it.
export function arcsOverlayCoverage(s: LaneBandsSettings) {
  return (
    !s.readConnectionsDown && !s.readConnectionsAbove && coverageReserves(s)
  )
}

function coverageReserves(s: LaneBandsSettings) {
  return reservedPx({ active: s.showCoverage, height: s.coverageHeight }) > 0
}

function arcsDrawn(s: LaneBandsSettings, lane: LaneBandData) {
  return s.drawnReadConnections !== 'off' && lane.hasArcs
}

function bandStackOf(
  s: LaneBandsSettings,
  lane: LaneBandData,
  heights: LaneBandHeights = s,
): Record<LaneBandKey, Band> {
  return {
    coverage: { active: s.showCoverage, height: heights.coverageHeight },
    readConnections: {
      active: arcsDrawn(s, lane) && !arcsOverlayCoverage(s),
      height: heights.readConnectionsHeight,
    },
    sashimi: {
      active: s.showSashimi && lane.hasSashimiStripArcs,
      height: heights.sashimiHeight,
    },
  }
}

/**
 * One lane's stack of bands above its pileup, and where its arcs draw, at
 * `heights` (the settings' own unless fitted). Which strips the lane reserves
 * reads the settings alone, so a fit never moves arcs on or off the coverage.
 * A strip bound to 0 px reserves nothing, so it reports no band and gets no
 * handle.
 */
export function laneBands(
  s: LaneBandsSettings,
  lane: LaneBandData,
  heights: LaneBandHeights = s,
): LaneBands {
  const bands = bandStackOf(s, lane, heights)
  const stack = stackBands(laneBandOrder(s), bands)
  return {
    stack,
    arcBand: bands.readConnections.active
      ? {
          top: stack.top.readConnections,
          height: stack.reserved.readConnections,
          down: s.readConnectionsDown,
        }
      : arcsDrawn(s, lane)
        ? coverageOverlayBand(stack)
        : undefined,
  }
}

// The three stated heights bound against the plot they share, over the pooled
// answer of which strips draw. Grouped lanes repeat the stack and reserve a
// subset of it, so binding the pooled stack keeps every lane's stack inside
// the plot too.
export function boundLaneBandHeights(s: LaneBandsInput, plot: BandPlot) {
  const { coverage, readConnections, sashimi } = boundStackedBands(
    laneBandOrder(s),
    bandStackOf(s, s),
    plot,
  )
  return {
    coverageHeight: coverage.height,
    readConnectionsHeight: readConnections.height,
    sashimiHeight: sashimi.height,
  }
}

// The height the band stack fills while the pileup is hidden: the track's
// own, capped at the grow ceiling in grow mode, so no height mode sizes the
// track from its lanes.
export function pileupHiddenHeight(s: {
  autoHeight: boolean
  fitTargetHeight: number
  growMaxHeight: number
}) {
  return s.autoHeight
    ? Math.min(s.fitTargetHeight, s.growMaxHeight)
    : s.fitTargetHeight
}

// The plot the strips share while the pileup is hidden: a lane's slot, less
// the floor the coverage keeps above them.
function stripPlot(slot: number) {
  return { height: slot, floor: MIN_BAND_HEIGHT }
}

// The pooled strips at their stated heights, bound top-down to the room the
// coverage's floor leaves of `slot`, and folded.
function stripStack(s: LaneBandsInput, slot: number) {
  const { readConnections, sashimi } = bandStackOf(s, s)
  return stackBands(
    STRIP_ORDER,
    boundStackedBands(
      STRIP_ORDER,
      { readConnections, sashimi },
      stripPlot(slot),
    ),
  )
}

// The strips at their stated heights, and the coverage taking what they leave
// of `slot`.
function coverageRemainderHeights(
  s: LaneBandsInput,
  slot: number,
): LaneBandHeights {
  const strips = stripStack(s, slot)
  return {
    coverageHeight: slot - strips.bottom,
    readConnectionsHeight: strips.height.readConnections,
    sashimiHeight: strips.height.sashimi,
  }
}

// Every band the stated stack reserves taking its share of `slot` in
// proportion, every other band 0.
function proportionalHeights(s: LaneBandsInput, slot: number): LaneBandHeights {
  const filled = fillStackedBands(laneBandOrder(s), bandStackOf(s, s), slot)
  return {
    coverageHeight: filled('coverage'),
    readConnectionsHeight: filled('readConnections'),
    sashimiHeight: filled('sashimi'),
  }
}

// The stated stack while the pileup is hidden, bound against the height the
// bands fill. With coverage, the strips keep their stated heights and the
// coverage takes the rest, so its own stated height takes no room from them.
// Without it, top-down with no floor kept for rows, so a short track still
// draws every band that fits rather than the ones above a phantom pileup.
export function pileupHiddenBands(s: LaneBandsInput, height: number) {
  return {
    ...s,
    ...(coverageReserves(s)
      ? coverageRemainderHeights(s, height)
      : boundLaneBandHeights(s, { height, floor: 0 })),
  }
}

// Each lane's whole-px slot of `height` while the pileup is hidden; no lanes
// draws as one.
export function laneSlotHeight(height: number, laneCount: number) {
  return Math.floor(height / Math.max(1, laneCount))
}

// The pooled band stack fitted to fill a lane's slot. With coverage, the
// strips keep their stated heights and the coverage takes the rest, one
// height for every lane. Without it, the bands fill the slot in proportion.
export function fittedLaneBandHeights(s: LaneBandsInput, slot: number) {
  return coverageReserves(s)
    ? coverageRemainderHeights(s, slot)
    : proportionalHeights(s, slot)
}

// One drag of one strip while the pileup is hidden, over the strips as each
// lane's slot draws them: from `MIN_BAND_HEIGHT` up to the room that leaves
// the coverage its floor beside the other strips.
export function dragPileupHiddenStrip(
  s: LaneBandsInput,
  key: StripKey,
  slot: number,
  target: number,
) {
  return dragBandHeight(stripStack(s, slot), key, stripPlot(slot), target)
}

// One drag of one band over the pooled stack, which every lane's handle for
// that band resizes.
export function dragLaneBand(
  s: LaneBandsInput,
  key: LaneBandKey,
  plot: BandPlot,
  target: number,
) {
  return dragBandHeight(
    stackBands(laneBandOrder(s), bandStackOf(s, s)),
    key,
    plot,
    target,
  )
}

// What each lane's band stack costs the fit-to-viewport row budget, in
// stacking order: a lane with nothing bound for a strip reserves none.
export function laneBandOverheads(
  settings: LaneBandsSettings,
  keys: readonly string[],
  arcLanes: ReadonlySet<string>,
  sashimiStripLanes: ReadonlySet<string>,
) {
  return keys.map(
    key =>
      laneBands(settings, {
        hasArcs: arcLanes.has(key),
        hasSashimiStripArcs: sashimiStripLanes.has(key),
      }).stack.bottom,
  )
}

export interface SectionStackOpts {
  rowHeight: number
  // Floor on the distance to the next section's top, so a section shorter than
  // its own label chip still leaves room for it. Only the stacking advance is
  // padded; `pileupHeight` stays the drawn row extent.
  minSectionHeight: number
  // The px each band is drawn at, the settings' own unless fitted.
  bandHeights?: LaneBandHeights
}

// Stack sections top-to-bottom, each reserving its own band stack and then its
// pileup. Every top is the running offset; whether a band stays sticky is a
// question of how the result is projected (`buildSectionRenders`).
export function computeStackedSections<L extends SectionLaneInput>(
  lanes: readonly L[],
  settings: LaneBandsSettings,
  opts: SectionStackOpts,
): SectionsLayout<L> {
  let top = 0
  const sections = lanes.map(lane => {
    const { stack, arcBand } = laneBands(settings, lane, opts.bandHeights)
    const sectionTop = top
    const pileupTop = sectionTop + stack.bottom
    const rowsHeight = lane.maxY * opts.rowHeight
    const pileupHeight =
      lane.heightOverridePx !== undefined && rowsHeight > 0
        ? Math.max(rowsHeight, lane.heightOverridePx)
        : rowsHeight
    top = Math.max(pileupTop + pileupHeight, sectionTop + opts.minSectionHeight)
    return {
      ...lane,
      sectionTop,
      bands: stack,
      arcBand: arcBand && { ...arcBand, top: sectionTop + arcBand.top },
      pileupTop,
      pileupHeight,
      rowsHeight,
      height: top - sectionTop,
    }
  })
  return { sections, contentHeight: top }
}

/**
 * How far below a section's pileup top the bottom of a display `viewportPx`
 * tall sits with it scrolled to its end: the floor its connectors' dips end
 * above (`flooredBend`).
 */
export function sectionDipFloor(
  layout: Pick<SectionsLayout, 'contentHeight'>,
  section: Pick<Section, 'pileupTop'>,
  viewportPx: number,
) {
  return Math.max(layout.contentHeight, viewportPx) - section.pileupTop
}

// Project a SectionsLayout into the screen-space draw geometry the renderers
// loop, through the same two scroll tiers the overlays use: band tops through
// `bandScreenTop` (sticky ungrouped, scrolling grouped), pileup content through
// `contentScreenY`. A pileup clip runs from its band-tier ceiling to its
// scrolled bottom, so ungrouped rows scroll under the sticky bands.
export function buildSectionRenders(
  layout: SectionsLayout,
  scroll: ScrollModel,
): SectionRender[] {
  return layout.sections.map(sec => {
    const pileupClipTop = bandScreenTop(sec.pileupTop, scroll)
    const clipHeightTo = (contentBottom: number) =>
      Math.max(
        0,
        Math.min(scroll.canvasHeight, contentScreenY(contentBottom, scroll)) -
          pileupClipTop,
      )
    const pileupBottom = sec.pileupTop + sec.pileupHeight
    return {
      pileupTopOffset: sec.pileupTop,
      coverageTopOffset: bandScreenTop(coverageBandTop(sec), scroll),
      pileupClipTop,
      pileupClipHeight: clipHeightTo(pileupBottom),
      connectorClipHeight: Math.max(0, scroll.canvasHeight - pileupClipTop),
      arcBand:
        sec.arcBand && sec.arcBand.height > 0
          ? { ...sec.arcBand, top: bandScreenTop(sec.arcBand.top, scroll) }
          : undefined,
      sashimiBand:
        sec.bands.reserved.sashimi > 0 ||
        bandAboveCoverage(sec.bands, 'sashimi')
          ? {
              top: bandScreenTop(
                sec.sectionTop + sec.bands.top.sashimi,
                scroll,
              ),
              height: sec.bands.reserved.sashimi,
              above: bandAboveCoverage(sec.bands, 'sashimi'),
            }
          : undefined,
    }
  })
}
