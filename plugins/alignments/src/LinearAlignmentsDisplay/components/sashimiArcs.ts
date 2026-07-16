import type { SashimiArc } from '../../features/sashimi/computeOverlay.ts'

// Stable React key, shared by overlay and export. Unique within one group
// section + side (the compute layer dedupes on refName:start:end:strand).
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
