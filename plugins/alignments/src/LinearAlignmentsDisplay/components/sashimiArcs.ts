import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/wiggle-core/constants'

import type { SashimiSide } from '../../features/sashimi/bandFeed.ts'
import type { SashimiLabelsBySide } from '../../features/sashimi/computeOverlay.ts'

// One entry of the model's `sashimiLabelSections`, shared by the overlay and
// the SVG export.
export interface SashimiLabelSection extends SashimiLabelsBySide {
  groupKey: string
  coverageOverlayTop: number
  sashimiBandTop: number
}

export interface SashimiBandHeights {
  coverageHeight: number
  sashimiArcsHeight: number
}

// Where a side's labels draw, the content-space box its mark's arcs stand in
// (`sashimiBandsOf`). The up height floors at 0 since a config may declare a
// coverage band shorter than the scalebar offset.
export function sashimiSideBand(
  section: SashimiLabelSection,
  side: SashimiSide,
  heights: SashimiBandHeights,
) {
  return side === 'down'
    ? { top: section.sashimiBandTop, height: heights.sashimiArcsHeight }
    : {
        top: section.coverageOverlayTop,
        height: Math.max(0, heights.coverageHeight - YSCALEBAR_LABEL_OFFSET),
      }
}

// One arc per refName:start:end. The strand stays out: it is resolved from
// whichever region reported the most reads, so a region loading later can change
// it, and a key that changed with it dropped the selection outline.
export function sashimiArcKey(arc: {
  refName: string
  start: number
  end: number
}) {
  return `${arc.refName}:${arc.start}:${arc.end}`
}

export const SASHIMI_FEATURE_ID_PREFIX = 'sashimi-'

// Scoped by group, so selecting a junction in one sample's section does not
// outline it in every other.
export function sashimiFeatureId(
  groupKey: string,
  arc: { refName: string; start: number; end: number },
) {
  return `${SASHIMI_FEATURE_ID_PREFIX}${groupKey}-${sashimiArcKey(arc)}`
}
