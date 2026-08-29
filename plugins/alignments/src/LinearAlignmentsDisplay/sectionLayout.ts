import { stackBands } from '@jbrowse/core/util/bandLayout'

import { computeArcBand } from './renderers/rendererTypes.ts'

import type { ReadConnectionsMode } from './constants.ts'
import type { ArcBand, SectionRender } from './renderers/rendererTypes.ts'
import type { BandBounds } from '@jbrowse/core/util/bandHeight'

// This display's band order, stated once: what a section reserves above its
// pileup, top to bottom. Both the pooled geometry and the per-section stacking
// fold it through `stackBands`, so the pileup top is the same statement in both.
const BAND_ORDER = ['coverage', 'arcs', 'sashimi'] as const

// Vertical band geometry for one stacked group section. Generalizes the
// single-pileup `belowCoverageBands` to N sections: every section reserves its
// own coverage -> arcs -> sashimi -> pileup stack via the shared fold, and
// `arcBandTop`/`arcBandHeight` carry the real `computeArcBand` draw band
// (relative to the section's own coverage top) so the renderers can draw
// per-section arcs in Stage 3.
export interface Section {
  groupKey: string
  label: string
  coverageTop: number
  coverageHeight: number
  arcBandTop: number
  arcBandHeight: number
  // Whether this section reserved a strip of its own for arcs (vs overlaying
  // coverage, or having no arcs at all). Drives the arc-resize handle, which
  // must not appear on a lane whose strip was dropped — it would land on the
  // coverage handle's pixel.
  hasArcsBand: boolean
  // Arcs point down (own band below coverage) vs up (overlay coverage). Carried
  // so the renderers anchor the arc Y-scale the same way per section.
  arcDown: boolean
  sashimiBandTop: number
  // Whether this section reserved the sashimi strip. Same story as
  // `hasArcsBand`: a lane with no down-bound junction has no strip to resize.
  hasSashimiBand: boolean
  pileupTop: number
  pileupHeight: number
  // The whole strip this section owns: the distance from its coverage top to
  // the next section's, so the last section's bottom is `contentHeight`.
  //
  // Not `pileupTop + pileupHeight - coverageTop`: a section shorter than its own
  // label chip is padded out to `minSectionHeight`, and that pad belongs to it.
  // Carried rather than left to consumers to reconstruct from the next section —
  // the label chips need exactly this to cull and to pin, and re-deriving it
  // there put a group's name over the next group's.
  height: number
  // Laid-out row count for this group (== max rows across its visible regions).
  maxY: number
}

export interface SectionsLayout {
  sections: Section[]
  // Total stacked height (last section's bottom edge).
  contentHeight: number
}

export interface SectionGroupInput {
  key: string
  label: string
  maxY: number
  // Whether this group's arcs draw anything at all — EITHER half, which is
  // `inkGroupKeys`. A lane with no arcs reserves no arc band and gets no draw
  // band, so its pileup sits right under its coverage rather than below an empty
  // strip — the visible symptom when grouping splits reads into lanes only some
  // of which have junctions. A lane whose every arc crosses a seam has its ink
  // in the cross-region overlay and none in any region's buffer, and must still
  // reserve.
  hasArcs: boolean
  // The same question for the sashimi strip: whether this group has a junction
  // bound for it (`groupsWithSashimiDownArcs`). Both are the raw per-lane data
  // signals — whether either strip is actually reserved also depends on the
  // display settings, which `reservesArcsBand`/`reservesSashimiBand` resolve.
  hasSashimiDownArcs: boolean
}

// Whether the paired-end arcs reserve a band of their own rather than overlaying
// the coverage histogram: down mode always, up mode only when there is no
// coverage band to overlay. The single spelling of that rule. Both
// `belowCoverageBandsGeometry` (sticky geometry, resize handles, fit budget) and
// `computeStackedSections` (per-section stacking) read it, and `computeArcBand`,
// which decides where the arcs actually draw, must agree with both.
export function reservesArcsBand(s: {
  readConnections: ReadConnectionsMode
  readConnectionsDown?: boolean
  showCoverage: boolean
}) {
  return (
    s.readConnections !== 'off' &&
    ((s.readConnectionsDown ?? false) || !s.showCoverage)
  )
}

// Resolve which of the below-coverage bands are present and their stacked tops.
// Single source of truth shared by the `belowCoverageBands` getter
// (sticky-coverage geometry, resize handles) and the fit-to-viewport row budget
// (which needs each section's reserved overhead but runs in an earlier `.views`
// block than that getter). `bottom` is where the pileup begins (==
// `coverageDisplayHeight`).
//
// The display settings decide whether each strip MAY be reserved; `hasArcs` and
// `hasSashimiDownArcs` say whether any lane has something to put in it. This is
// the pooled answer over every lane, where `computeStackedSections` asks per
// lane — ungrouped, the one lane makes them the same statement, which is what
// keeps this bottom and that section's `pileupTop` equal.
export interface BelowCoverageBandsInput {
  showCoverage: boolean
  coverageHeight: number
  readConnections: ReadConnectionsMode
  readConnectionsDown: boolean
  readConnectionsHeight: number
  showSashimiArcs: boolean
  sashimiArcsHeight: number
  // Whether any lane has arc-band ink (`inkGroupKeys`) — the data half of the
  // reserve rule, which `computeStackedSections` applies per lane and this
  // pooled geometry applies across them. Both halves, or the global bottom
  // reserves a strip nothing draws in and lands `readConnectionsHeight` px
  // below the pileup the sections actually laid out.
  hasArcs: boolean
  // Whether any junction actually lands in the below-coverage strip, already
  // resolved against the mode + score filter by `groupsWithSashimiDownArcs`
  // (mode lives there, not here: 'auto' has to inspect the junctions to know).
  hasSashimiDownArcs: boolean
  // The range every band height is bound to at read time. These are config
  // slots, so a config or a session snapshot states one directly and passes no
  // drag clamp.
  bandBounds?: BandBounds
}

// Whether the sashimi junctions reserve the strip below coverage: only with the
// coverage band they hang off, and only when a junction is actually bound for it.
// The single spelling of that rule, read by `belowCoverageBandsGeometry` (global
// geometry, fit budget) and `computeStackedSections` (per-section stacking).
function reservesSashimiBand(s: {
  showSashimiArcs: boolean
  showCoverage: boolean
  hasSashimiDownArcs: boolean
}) {
  return s.showSashimiArcs && s.showCoverage && s.hasSashimiDownArcs
}

// The settings half alone, with neither data half answered. The pooled geometry
// takes it plus one answer for the whole stack; the fit budget takes it once per
// lane, with that lane's own — see `totalBelowCoverageOverhead`.
export type BelowCoverageBandsSettings = Omit<
  BelowCoverageBandsInput,
  'hasArcs' | 'hasSashimiDownArcs'
>

// What the below-coverage strips cost the fit-to-viewport row budget across the
// whole stack: each lane's own reserved bands, SUMMED.
//
// Not one lane's answer times the lane count, which is what this was and which
// only agrees with the sections where every lane reserves the same strips. A
// grouping routinely leaves lanes with nothing bound for one — the 'Not split'
// lane has no arc, an unspliced lane no junction — and `computeStackedSections`
// gives those lanes no strip. Charging them for it withholds
// `readConnectionsHeight` (or `sashimiArcsHeight`) per arc-less lane from the
// rows and leaves exactly that much dead space at the bottom of a mode whose
// promise is filling the display.
export function totalBelowCoverageOverhead(
  settings: BelowCoverageBandsSettings,
  keys: readonly string[],
  arcLanes: ReadonlySet<string>,
  sashimiDownLanes: ReadonlySet<string>,
) {
  let total = 0
  for (const key of keys) {
    total += belowCoverageBandsGeometry({
      ...settings,
      hasArcs: arcLanes.has(key),
      hasSashimiDownArcs: sashimiDownLanes.has(key),
    }).bottom
  }
  return total
}

export function belowCoverageBandsGeometry(s: BelowCoverageBandsInput) {
  const hasArcsBand = reservesArcsBand(s) && s.hasArcs
  const hasSashimiBand = reservesSashimiBand(s)
  const bounds = s.bandBounds
  const { top, reserved, bottom } = stackBands(BAND_ORDER, {
    coverage: { active: s.showCoverage, height: s.coverageHeight, bounds },
    arcs: { active: hasArcsBand, height: s.readConnectionsHeight, bounds },
    sashimi: { active: hasSashimiBand, height: s.sashimiArcsHeight, bounds },
  })
  return {
    // The coverage band's reserved height, 0 when off — what the render state
    // and the coverage painters/hit tests take, so none of them re-derives the
    // gate from `showCoverage` beside a raw height.
    coverageHeight: reserved.coverage,
    hasArcsBand,
    hasSashimiBand,
    arcsBandTop: top.arcs,
    sashimiBandTop: top.sashimi,
    bottom,
  }
}

// Band settings shared by every section (heights are display-global in v1).
// Defaults make the read-connection bands absent, so callers that only stack
// coverage + pileup can omit them.
export interface SectionBandOpts {
  coverageHeight: number
  rowHeight: number
  showCoverage?: boolean
  coverageYOffset?: number
  readConnections?: ReadConnectionsMode
  readConnectionsDown?: boolean
  readConnectionsHeight?: number
  showSashimiArcs?: boolean
  sashimiHeight?: number
  // Floor on the distance to the next section's top, so a section shorter than
  // its own label chip still leaves room for it (the chip is anchored at the
  // section top, so without this consecutive chips overlap). Only the stacking
  // advance is padded — `pileupHeight` stays the drawn row extent, so the pad
  // reads as space below the lane rather than as clickable/paintable pileup.
  minSectionHeight?: number
}

// Stack sections top-to-bottom, each reserving its own coverage -> arcs ->
// sashimi -> pileup bands. Unlike the single-pileup layout (sticky coverage at
// the top, only the pileup scrolls), grouped coverage scrolls with its section,
// so every band's top is just the running offset. The single-section (N==1)
// case reproduces the prior ungrouped reserved layout exactly.
//
// Both below-coverage strips are reserved per section (`hasArcs` /
// `hasSashimiDownArcs`), so a lane with nothing bound for a strip doesn't carry
// it as dead space. The heights themselves stay display-global.
export function computeStackedSections(
  groups: SectionGroupInput[],
  opts: SectionBandOpts,
): SectionsLayout {
  const showCoverage = opts.showCoverage ?? true
  const readConnections = opts.readConnections ?? 'off'
  const arcBand = computeArcBand({
    showCoverage,
    coverageHeight: opts.coverageHeight,
    coverageYOffset: opts.coverageYOffset ?? 0,
    readConnections,
    readConnectionsDown: opts.readConnectionsDown,
    readConnectionsHeight: opts.readConnectionsHeight,
  })
  // The settings half of each strip's reserve rule, constant across sections;
  // the data half (`g.hasArcs` / `g.hasSashimiDownArcs`) varies per lane.
  const reservesArcs = reservesArcsBand({
    readConnections,
    readConnectionsDown: opts.readConnectionsDown,
    showCoverage,
  })
  const showSashimiArcs = opts.showSashimiArcs ?? false

  let top = 0
  const sections = groups.map(g => {
    const hasArcsBand = reservesArcs && g.hasArcs
    const hasSashimiBand = reservesSashimiBand({
      showSashimiArcs,
      showCoverage,
      hasSashimiDownArcs: g.hasSashimiDownArcs,
    })
    const stack = stackBands(BAND_ORDER, {
      coverage: { active: showCoverage, height: opts.coverageHeight },
      arcs: { active: hasArcsBand, height: opts.readConnectionsHeight ?? 0 },
      sashimi: { active: hasSashimiBand, height: opts.sashimiHeight ?? 0 },
    })
    // Up-mode arcs overlay coverage and reserve nothing, so an arc-less lane
    // still drops its draw band — nothing paints there either way, and a zero
    // height is what tells the renderers to skip the pass.
    const band = g.hasArcs ? arcBand : undefined
    const coverageTop = top
    const pileupTop = coverageTop + stack.bottom
    const pileupHeight = g.maxY * opts.rowHeight
    // `top` becomes this section's bottom edge — and so the next one's top,
    // which is what makes `height` below the strip this section owns.
    top = Math.max(
      pileupTop + pileupHeight,
      coverageTop + (opts.minSectionHeight ?? 0),
    )
    return {
      groupKey: g.key,
      label: g.label,
      coverageTop,
      coverageHeight: stack.reserved.coverage,
      // Draw band, relative to this section's coverage top — matches
      // computeArcBand so Stage 3 renderers reproduce the ungrouped band.
      arcBandTop: coverageTop + (band?.top ?? stack.top.arcs),
      arcBandHeight: band?.height ?? 0,
      hasArcsBand,
      arcDown: band?.down ?? false,
      sashimiBandTop: coverageTop + stack.top.sashimi,
      hasSashimiBand,
      pileupTop,
      pileupHeight,
      height: top - coverageTop,
      maxY: g.maxY,
    }
  })
  return { sections, contentHeight: top }
}

// Resolve a SectionsLayout into the screen-space draw geometry the renderers
// loop. Ungrouped (one section) reproduces the prior sticky-coverage layout
// exactly: coverage clips to the full canvas, the pileup clips from its top to
// the canvas bottom, and scrollTop is applied only by the pileup shaders (via
// rangeY0), never to the coverage band. Grouped sections instead scroll their
// whole coverage+pileup band as a unit, so scrollTop shifts every offset/clip.
export function buildSectionRenders(
  layout: SectionsLayout,
  opts: { scrollTop: number; canvasHeight: number },
): SectionRender[] {
  const { scrollTop, canvasHeight } = opts
  const grouped = layout.sections.length > 1
  // Screen-space arc band for a section whose band top has already had any
  // scroll applied. Undefined when the section reserves no arcs.
  const arcBandAt = (sec: Section, top: number): ArcBand | undefined =>
    sec.arcBandHeight > 0
      ? { top, height: sec.arcBandHeight, down: sec.arcDown }
      : undefined
  if (!grouped) {
    const sec = layout.sections[0]
    const pileupTop = sec?.pileupTop ?? 0
    // The sticky-coverage layout clips the pileup to the viewport below coverage
    // (only the pileup content scrolls). But a section that reserves no pileup
    // rows — `showPileup` off, or an empty/collapsed pileup — must clip to zero
    // so its (still laid-out) reads don't paint into that viewport. An empty
    // pileup draws nothing either way, so gating on `pileupHeight > 0` is safe.
    const hasPileup = (sec?.pileupHeight ?? 0) > 0
    return [
      {
        pileupTopOffset: pileupTop,
        coverageTopOffset: 0,
        covClipTop: 0,
        covClipHeight: sec?.coverageHeight ?? 0,
        pileupClipTop: pileupTop,
        pileupClipHeight: hasPileup ? Math.max(0, canvasHeight - pileupTop) : 0,
        // Coverage + arc band are sticky in ungrouped mode (only the pileup
        // scrolls), so the arc band keeps its content-space top.
        arcBand: sec ? arcBandAt(sec, sec.arcBandTop) : undefined,
      },
    ]
  }
  return layout.sections.map(sec => ({
    pileupTopOffset: sec.pileupTop,
    coverageTopOffset: sec.coverageTop - scrollTop,
    covClipTop: sec.coverageTop - scrollTop,
    covClipHeight: sec.coverageHeight,
    pileupClipTop: sec.pileupTop - scrollTop,
    pileupClipHeight: sec.pileupHeight,
    // The whole section scrolls as a unit, so the arc band scrolls too.
    arcBand: arcBandAt(sec, sec.arcBandTop - scrollTop),
  }))
}
