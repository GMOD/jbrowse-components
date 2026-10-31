import {
  bandDragBounds,
  boundStackedBands,
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
// pileup, top to bottom.
const BAND_ORDER = ['coverage', 'arcs', 'sashimi'] as const
type BandKey = (typeof BAND_ORDER)[number]

// The geometry of one stacked lane, in content space. The lane's own identity
// and data ride beside it on `LaneSection`.
export interface Section {
  coverageTop: number
  coverageHeight: number
  // The arcs' DRAW band, which is not the same question as `hasArcsBand`:
  // up-mode arcs reserve nothing and draw over the coverage histogram.
  arcBandTop: number
  arcBandHeight: number
  arcDown: boolean
  // Whether this lane reserved a strip of its own for arcs. Drives the
  // arc-resize handle, which must not appear on a lane whose strip was dropped
  // — it would land on the coverage handle's pixel.
  hasArcsBand: boolean
  sashimiBandTop: number
  hasSashimiBand: boolean
  pileupTop: number
  // The laid-out rows, or the height a drag pinned this lane at when that is
  // taller (the surplus draws blank, like a track dragged past its content).
  pileupHeight: number
  // Room under the pileup band for the deepest connector that dips below its
  // row, so the last rows' curves finish above the next section. Not part of
  // `pileupHeight`: no read draws or hit-tests there, and the dip law takes the
  // band without it.
  dipReserve: number
  // The whole strip this section owns, down to the next section's coverage
  // top: carried because the dip reserve and the label-chip pad belong to it,
  // and re-deriving it from the next section put a group's name over the next.
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
  hasSashimiDownArcs: boolean
  // Height a drag pinned this lane's pileup band at. Only ever pads, and only a
  // lane that draws rows at all, which keeps a collapsed lane's banked
  // override from reopening its band.
  heightOverridePx: number | undefined
}

// How far the band bottom a section's resize handle sits on travels per px of a
// DISPLAY-GLOBAL band height: its own band, plus every band of that kind stacked
// above it, since those grow by the same px and push it down. Dividing a drag by
// it keeps the handle under the pointer.
export function stackedBandGain<T>(
  sections: readonly T[],
  index: number,
  reservesBand: (section: T) => boolean,
) {
  let gain = 1
  for (const section of sections.slice(0, index)) {
    if (reservesBand(section)) {
      gain += 1
    }
  }
  return gain
}

// The settings half of every lane's band stack: whether each strip MAY be
// reserved and how tall, with neither data half answered.
export interface BelowCoverageBandsSettings {
  showCoverage: boolean
  coverageHeight: number
  drawnReadConnections: ReadConnectionsMode
  readConnectionsDown: boolean
  readConnectionsHeight: number
  showSashimi: boolean
  sashimiHeight: number
}

// What a lane's data says about its strips, the half of the reserve rule the
// settings cannot answer.
export interface LaneBandData {
  hasArcs: boolean
  hasSashimiDownArcs: boolean
}

export type BelowCoverageBandsInput = BelowCoverageBandsSettings & LaneBandData

export interface LaneBands {
  // The coverage band's reserved height, 0 when off.
  coverageHeight: number
  hasArcsBand: boolean
  hasSashimiBand: boolean
  arcsBandTop: number
  sashimiBandTop: number
  // Where the pileup begins, relative to the lane's coverage top.
  bottom: number
  // Where the arcs draw, relative to the lane's coverage top, or undefined
  // where they draw nothing.
  arcBand: ArcBand | undefined
}

// Up-mode arcs overlay the coverage histogram, so their zero anchor is its
// BASELINE, the scalebar inset above the band bottom. Floored here: a stated
// coverage height below the inset is an honored state.
function coverageOverlayBand(stack: BandStack<BandKey>) {
  return {
    top: stack.top.coverage,
    height: Math.max(0, stack.reserved.coverage - YSCALEBAR_LABEL_OFFSET),
    down: false,
  }
}

// Arcs pointing down always take a strip of their own; arcs pointing up
// overlay the coverage histogram when there is one to overlay, and take a
// strip of their own otherwise. Either strip is active only for a lane with
// something to put in it.
function arcsOverlayCoverage(s: BelowCoverageBandsSettings) {
  return (
    !s.readConnectionsDown &&
    reservedPx({ active: s.showCoverage, height: s.coverageHeight }) > 0
  )
}

function bandStackOf(
  s: BelowCoverageBandsSettings,
  lane: LaneBandData,
): Record<BandKey, Band> {
  const arcsOn = s.drawnReadConnections !== 'off' && lane.hasArcs
  return {
    coverage: { active: s.showCoverage, height: s.coverageHeight },
    arcs: {
      active: arcsOn && !arcsOverlayCoverage(s),
      height: s.readConnectionsHeight,
    },
    sashimi: {
      active: s.showSashimi && lane.hasSashimiDownArcs,
      height: s.sashimiHeight,
    },
  }
}

/**
 * One lane's stack of bands above its pileup, and where its arcs draw. A strip
 * bound to 0 px reserves nothing, so it reports no band and gets no handle.
 */
export function laneBands(
  s: BelowCoverageBandsSettings,
  lane: LaneBandData,
): LaneBands {
  const bands = bandStackOf(s, lane)
  const stack = stackBands(BAND_ORDER, bands)
  const arcsOn = s.drawnReadConnections !== 'off' && lane.hasArcs
  return {
    coverageHeight: stack.reserved.coverage,
    hasArcsBand: stack.reserved.arcs > 0,
    hasSashimiBand: stack.reserved.sashimi > 0,
    arcsBandTop: stack.top.arcs,
    sashimiBandTop: stack.top.sashimi,
    bottom: stack.bottom,
    arcBand: bands.arcs.active
      ? {
          top: stack.top.arcs,
          height: stack.reserved.arcs,
          down: s.readConnectionsDown,
        }
      : arcsOn
        ? coverageOverlayBand(stack)
        : undefined,
  }
}

// The three stated heights bound against the plot they share, over the pooled
// answer of which strips draw. Grouped lanes repeat the stack and reserve a
// subset of it, so binding the pooled stack keeps every lane's stack inside
// the plot too.
export function boundBelowCoverageHeights(
  s: BelowCoverageBandsInput,
  plot: BandPlot,
) {
  const { coverage, arcs, sashimi } = boundStackedBands(
    BAND_ORDER,
    bandStackOf(s, s),
    plot,
  )
  return {
    coverageHeight: coverage.height,
    readConnectionsHeight: arcs.height,
    sashimiHeight: sashimi.height,
  }
}

// The legal range for a drag of one band over the pooled stack, which every
// lane's handle for that band resizes.
export function belowCoverageDragBounds(
  s: BelowCoverageBandsInput,
  key: BandKey,
  plot: BandPlot,
) {
  return bandDragBounds(stackBands(BAND_ORDER, bandStackOf(s, s)), key, plot)
}

// What each lane's band stack costs the fit-to-viewport row budget, in
// stacking order: a lane with nothing bound for a strip reserves none.
export function laneBandOverheads(
  settings: BelowCoverageBandsSettings,
  keys: readonly string[],
  arcLanes: ReadonlySet<string>,
  sashimiDownLanes: ReadonlySet<string>,
) {
  return keys.map(
    key =>
      laneBands(settings, {
        hasArcs: arcLanes.has(key),
        hasSashimiDownArcs: sashimiDownLanes.has(key),
      }).bottom,
  )
}

export interface SectionStackOpts<L> {
  rowHeight: number
  // Floor on the distance to the next section's top, so a section shorter than
  // its own label chip still leaves room for it. Only the stacking advance is
  // padded; `pileupHeight` stays the drawn row extent.
  minSectionHeight: number
  // How far below a lane's pileup band its deepest dipping connector reaches,
  // given that band's height (`connectorDipReservePx`). Pads only the advance.
  dipReservePx: (lane: L, pileupHeight: number) => number
}

// Stack sections top-to-bottom, each reserving its own band stack and then its
// pileup. Every top is the running offset; whether a band stays sticky is a
// question of how the result is projected (`buildSectionRenders`).
export function computeStackedSections<L extends SectionLaneInput>(
  lanes: readonly L[],
  settings: BelowCoverageBandsSettings,
  opts: SectionStackOpts<L>,
): SectionsLayout<L> {
  let top = 0
  const sections = lanes.map(lane => {
    const bands = laneBands(settings, lane)
    const coverageTop = top
    const pileupTop = coverageTop + bands.bottom
    const rowsHeight = lane.maxY * opts.rowHeight
    const pileupHeight =
      lane.heightOverridePx !== undefined && rowsHeight > 0
        ? Math.max(rowsHeight, lane.heightOverridePx)
        : rowsHeight
    const dipReserve =
      pileupHeight > 0 ? opts.dipReservePx(lane, pileupHeight) : 0
    top = Math.max(
      pileupTop + pileupHeight + dipReserve,
      coverageTop + opts.minSectionHeight,
    )
    return {
      ...lane,
      coverageTop,
      coverageHeight: bands.coverageHeight,
      arcBandTop: coverageTop + (bands.arcBand?.top ?? bands.arcsBandTop),
      arcBandHeight: bands.arcBand?.height ?? 0,
      arcDown: bands.arcBand?.down ?? false,
      hasArcsBand: bands.hasArcsBand,
      sashimiBandTop: coverageTop + bands.sashimiBandTop,
      hasSashimiBand: bands.hasSashimiBand,
      pileupTop,
      pileupHeight,
      dipReserve,
      height: top - coverageTop,
    }
  })
  return { sections, contentHeight: top }
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
    const coverageTop = bandScreenTop(sec.coverageTop, scroll)
    return {
      pileupTopOffset: sec.pileupTop,
      coverageTopOffset: coverageTop,
      covClipTop: coverageTop,
      covClipHeight: sec.coverageHeight,
      pileupClipTop,
      pileupClipHeight: clipHeightTo(pileupBottom),
      connectorClipTop: pileupClipTop,
      connectorClipHeight: clipHeightTo(pileupBottom + sec.dipReserve),
      arcBand:
        sec.arcBandHeight > 0
          ? {
              top: bandScreenTop(sec.arcBandTop, scroll),
              height: sec.arcBandHeight,
              down: sec.arcDown,
            }
          : undefined,
      sashimiBandTop: sec.hasSashimiBand
        ? bandScreenTop(sec.sashimiBandTop, scroll)
        : undefined,
    }
  })
}
