import type { SashimiArc } from '../../features/sashimi/computeOverlay.ts'
import type { SashimiSide } from '../../features/sashimi/junctions.ts'

// One entry of the model's `sashimiArcSections`: a group's arcs already split
// into the two sub-bands, with each band's content-space top. Named here rather
// than left inferred so the overlay and the SVG export state the same contract.
export interface SashimiArcSection {
  groupKey: string
  up: SashimiArc[]
  down: SashimiArc[]
  coverageOverlayTop: number
  sashimiBandTop: number
}

// Every section contributes both sub-bands. Looping this (rather than spelling
// out an 'up' block and a 'down' block at each of the two call sites) is what
// keeps a side from being rendered in one path and forgotten in the other; the
// arcs come off `section[side]`, so the pairing can't be crossed either.
export const SASHIMI_SIDES = [
  'up',
  'down',
] as const satisfies readonly SashimiSide[]

// The remaining half of that pairing: which band top a side hangs off. Up arcs
// are drawn over the coverage histogram, down arcs in the reserved strip below.
export function sashimiSideTop(section: SashimiArcSection, side: SashimiSide) {
  return side === 'up' ? section.coverageOverlayTop : section.sashimiBandTop
}

// Stable React key, shared by overlay and export. Unique within one group
// section + side: the compute layer emits one arc per refName:start:end, so the
// strand here only records which tint that junction resolved to.
export function sashimiArcKey(arc: SashimiArc) {
  return `${arc.refName}:${arc.start}:${arc.end}:${arc.strand}`
}

// Display-wide selection identity, scoped by group section. Selection lives once
// for the whole display, but the same junction can appear in several grouped
// sections (e.g. per-sample RNA-seq), so the group must be part of the key — an
// unscoped key selects that junction in every group at once.
export function sashimiSelectionKey(groupKey: string, arc: SashimiArc) {
  return `${groupKey}\t${sashimiArcKey(arc)}`
}
