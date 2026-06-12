import type { SectionRender } from './renderers/rendererTypes.ts'

// Vertical band geometry for one stacked group section. Generalizes the
// single-pileup `belowCoverageBands` to N sections. Arc/sashimi bands are
// pinned to 0 in grouped mode for v1 (read-connections are disabled when
// grouping — see GROUP_BY_PLAN.md scope cuts) but kept in the shape so they can
// be restored without re-architecting the geometry.
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

// Stack grouped sections top-to-bottom, each = coverage band then pileup band.
// Unlike the single-pileup layout (sticky coverage at the top, only the pileup
// scrolls), grouped coverage scrolls with its section, so every band's top is
// just the running offset. Read-connection (arc/sashimi) bands are 0 here.
export function computeStackedSections(
  groups: SectionGroupInput[],
  opts: { coverageHeight: number; rowHeight: number },
): SectionsLayout {
  let top = 0
  const sections = groups.map(g => {
    const coverageTop = top
    const pileupTop = coverageTop + opts.coverageHeight
    const pileupHeight = g.maxY * opts.rowHeight
    top = pileupTop + pileupHeight
    return {
      groupKey: g.key,
      label: g.label,
      coverageTop,
      coverageHeight: opts.coverageHeight,
      arcBandTop: pileupTop,
      arcBandHeight: 0,
      sashimiBandTop: pileupTop,
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
