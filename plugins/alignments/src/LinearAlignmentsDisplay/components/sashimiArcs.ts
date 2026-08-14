import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/wiggle-core/constants'

import type {
  SashimiArc,
  SashimiBandHeights,
} from '../../features/sashimi/arcGeometry.ts'
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

// The remaining half of that pairing: WHERE a side draws. Up arcs are drawn over
// the coverage histogram, down arcs in the reserved strip below it — and the
// box's height and clipping follow from that same choice, so they are derived
// here beside the top rather than re-picked at each call site off an `isDown`.
// (As separate decisions, nothing stopped the down strip's arcs being given the
// coverage band's height.) `clipped` is the down strip's: it must not paint over
// the pileup underneath it, whereas the up band stays open so an arc can rise
// into the coverage band's own top margin.
export function sashimiSideBand(
  section: SashimiArcSection,
  side: SashimiSide,
  heights: SashimiBandHeights,
) {
  return side === 'down'
    ? {
        top: section.sashimiBandTop,
        height: heights.sashimiArcsHeight,
        clipped: true,
      }
    : {
        top: section.coverageOverlayTop,
        // The band runs from this box's own top — the histogram top, already one
        // y-scalebar offset below the coverage band's — to the band's bottom.
        height: heights.coverageHeight - YSCALEBAR_LABEL_OFFSET,
        clipped: false,
      }
}

/**
 * Split one group's arcs into the two sub-band buckets, preserving order.
 *
 * `SashimiSide` has exactly two members, so a single pass with an else IS the
 * complete partition — which two `filter` calls only were by inspection, and
 * only as long as nobody added a third side. Returning the section's own
 * `up`/`down` pair (rather than a fresh shape) is the other half: the caller
 * spreads it, so a bucket can't be dropped or crossed on the way in.
 *
 * One pass also matters here — `sashimiArcSections` recomputes per section on
 * every pan/zoom.
 */
export function splitArcsBySide(
  arcs: SashimiArc[],
): Pick<SashimiArcSection, 'up' | 'down'> {
  const up: SashimiArc[] = []
  const down: SashimiArc[] = []
  for (const arc of arcs) {
    if (arc.side === 'up') {
      up.push(arc)
    } else {
      down.push(arc)
    }
  }
  return { up, down }
}

// Stable React key, shared by overlay and export. Unique within one group
// section + side: each compute layer emits one arc per junction, so the strand
// here only records which tint that junction resolved to.
//
// BOTH refNames, because a split-read junction's ends can be on different
// chromosomes and the two halves of one fusion are then distinguished by nothing
// else — a foldback's two junctions share a `start` on the same contig and
// differ only in where they land. `endRefName` equals `refName` for every splice
// junction, so this is the old key with a repeated field on that path.
export function sashimiArcKey(arc: SashimiArc) {
  return `${arc.refName}:${arc.start}:${arc.endRefName}:${arc.end}:${arc.strand}`
}

// Display-wide selection identity, scoped by group section. Selection lives once
// for the whole display, but the same junction can appear in several grouped
// sections (e.g. per-sample RNA-seq), so the group must be part of the key — an
// unscoped key selects that junction in every group at once.
export function sashimiSelectionKey(groupKey: string, arc: SashimiArc) {
  return `${groupKey}\t${sashimiArcKey(arc)}`
}
