import { computeArcBand } from './renderers/rendererTypes.ts'

import type { ReadConnectionsMode } from './constants.ts'
import type { SectionRender } from './renderers/rendererTypes.ts'

// Vertical band geometry for one stacked group section. Generalizes the
// single-pileup `belowCoverageBands` to N sections: every section reserves its
// own coverage -> arcs -> sashimi -> pileup stack via the shared
// `computeBandStack`, and `arcBandTop`/`arcBandHeight` carry the real
// `computeArcBand` draw band (relative to the section's own coverage top) so
// the renderers can draw per-section arcs in Stage 3.
export interface Section {
  groupKey: string
  label: string
  coverageTop: number
  coverageHeight: number
  arcBandTop: number
  arcBandHeight: number
  sashimiBandTop: number
  pileupTop: number
  pileupHeight: number
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
}

// Reserved vertical offsets for the bands stacked below a section's coverage,
// top to bottom: coverage -> arcs -> sashimi -> pileup. Pure extraction of the
// math the single-section `belowCoverageBands` used, so the ungrouped layout
// and each grouped section reserve space identically. `pileupTop` is the
// reserved bottom (where the pileup begins). Up-mode arcs overlay coverage, so
// they pass `hasArcsBand: false` and reserve nothing.
export interface BandStackInput {
  coverageHeight: number // already gated to 0 when coverage is hidden
  hasArcsBand: boolean
  arcsHeight: number
  hasSashimiBand: boolean
  sashimiHeight: number
}

export function computeBandStack(s: BandStackInput) {
  const arcsBandTop = s.coverageHeight
  const sashimiBandTop = arcsBandTop + (s.hasArcsBand ? s.arcsHeight : 0)
  const pileupTop = sashimiBandTop + (s.hasSashimiBand ? s.sashimiHeight : 0)
  return { arcsBandTop, sashimiBandTop, pileupTop }
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
  hasSashimiBand?: boolean
  sashimiHeight?: number
}

// Stack sections top-to-bottom, each reserving its own coverage -> arcs ->
// sashimi -> pileup bands. Unlike the single-pileup layout (sticky coverage at
// the top, only the pileup scrolls), grouped coverage scrolls with its section,
// so every band's top is just the running offset. The single-section (N==1)
// case reproduces the prior ungrouped reserved layout exactly.
export function computeStackedSections(
  groups: SectionGroupInput[],
  opts: SectionBandOpts,
): SectionsLayout {
  const showCoverage = opts.showCoverage ?? true
  const coverageBand = showCoverage ? opts.coverageHeight : 0
  const arcsHeight = opts.readConnectionsHeight ?? 0
  const readConnections = opts.readConnections ?? 'off'
  const arcsOn = readConnections !== 'off'
  // Reserve a dedicated arcs band only when arcs don't overlay coverage: down
  // mode always, up mode only when there's no coverage band to overlay.
  // Mirrors `computeArcBand` + `belowCoverageBands`.
  const hasArcsBand = arcsOn && ((opts.readConnectionsDown ?? false) || !showCoverage)
  const arcBand = computeArcBand({
    showCoverage,
    coverageHeight: opts.coverageHeight,
    coverageYOffset: opts.coverageYOffset ?? 0,
    readConnections,
    readConnectionsDown: opts.readConnectionsDown,
    readConnectionsHeight: opts.readConnectionsHeight,
  })

  let top = 0
  const sections = groups.map(g => {
    const coverageTop = top
    const stack = computeBandStack({
      coverageHeight: coverageBand,
      hasArcsBand,
      arcsHeight,
      hasSashimiBand: opts.hasSashimiBand ?? false,
      sashimiHeight: opts.sashimiHeight ?? 0,
    })
    const pileupTop = coverageTop + stack.pileupTop
    const pileupHeight = g.maxY * opts.rowHeight
    top = pileupTop + pileupHeight
    return {
      groupKey: g.key,
      label: g.label,
      coverageTop,
      coverageHeight: coverageBand,
      // Draw band, relative to this section's coverage top — matches
      // computeArcBand so Stage 3 renderers reproduce the ungrouped band.
      arcBandTop: coverageTop + (arcBand?.top ?? stack.arcsBandTop),
      arcBandHeight: arcBand?.height ?? 0,
      sashimiBandTop: coverageTop + stack.sashimiBandTop,
      pileupTop,
      pileupHeight,
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
  if (!grouped) {
    const pileupTop = layout.sections[0]?.pileupTop ?? 0
    return [
      {
        pileupTopOffset: pileupTop,
        coverageTopOffset: 0,
        covClipTop: 0,
        covClipHeight: canvasHeight,
        pileupClipTop: pileupTop,
        pileupClipHeight: Math.max(0, canvasHeight - pileupTop),
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
  }))
}
