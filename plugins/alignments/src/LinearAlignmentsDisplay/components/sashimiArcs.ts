import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/wiggle-core/constants'

import type {
  SashimiArc,
  SashimiArcsBySide,
} from '../../features/sashimi/computeOverlay.ts'

// One entry of the model's `sashimiArcSections`, shared by the overlay and the
// SVG export.
export interface SashimiArcSection extends SashimiArcsBySide {
  groupKey: string
  coverageOverlayTop: number
  sashimiBandTop: number
}

export const SASHIMI_SIDES = [
  'up',
  'down',
] as const satisfies readonly (keyof SashimiArcsBySide)[]

export interface SashimiBandHeights {
  coverageHeight: number
  sashimiArcsHeight: number
}

// Where a side draws. Up arcs overlay the coverage histogram, unclipped so a
// tall arc can rise into its top margin; down arcs sit in the strip below it,
// clipped so they cannot paint over the pileup. The up height floors at 0 since
// a config may declare a coverage band shorter than the scalebar offset.
export function sashimiSideBand(
  section: SashimiArcSection,
  side: keyof SashimiArcsBySide,
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
        height: Math.max(0, heights.coverageHeight - YSCALEBAR_LABEL_OFFSET),
        clipped: false,
      }
}

// One arc per refName:start:end. The strand stays out: it is resolved from
// whichever region reported the most reads, so a region loading later can change
// it, and a key that changed with it dropped the selection outline.
export function sashimiArcKey(
  arc: Pick<SashimiArc, 'refName' | 'start' | 'end'>,
) {
  return `${arc.refName}:${arc.start}:${arc.end}`
}

// Scoped by group, so selecting a junction in one sample's section does not
// outline it in every other.
export function sashimiFeatureId(
  groupKey: string,
  arc: Pick<SashimiArc, 'refName' | 'start' | 'end'>,
) {
  return `sashimi-${groupKey}-${sashimiArcKey(arc)}`
}
