import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/wiggle-core/constants'

import { projectSashimiArcs } from '../features/sashimi/computeOverlay.ts'

import type { MergedJunction } from '../features/sashimi/junctions.ts'
import type { SashimiArcSection } from './components/sashimiArcs.ts'
import type { LaneSection } from './lanes.ts'

/**
 * The per-section sashimi geometry, a walk of `renderSections` turning one
 * lane's band into the arcs drawn in it. BAND-LOCAL, reading no `scrollTop`:
 * both hosts — the live SVG overlay and the export — place the box at
 * `bandScreenTop(bandTop, …)`, so a grouped track scrolls without replaying it.
 */

// Only the section fields this reads. Narrower than `LaneSection` so a
// test can build one, and so a new field on a lane doesn't read as an input
// here.
//
// The junctions are NOT off the lane: they are merged over the region set on
// screen, which the layout must never see (`sashimiJunctionSections` says why),
// so the model hands over its own projection of a lane rather than the lane.
type SashimiSectionInput = Pick<
  LaneSection,
  'groupKey' | 'sashimiDownKeys' | 'coverageTop' | 'sashimiBandTop'
> & {
  junctions: readonly MergedJunction[]
}

export interface SashimiSectionsInput {
  sections: readonly SashimiSectionInput[]
  bpToScreenX: (refName: string, bp: number) => number | undefined
  // The view's width — the overlay sizes its `<svg>` with it and the export
  // paints at `canvasWidth`, which `renderDisplaySvg` resolves to `view.width`
  // for every LGV display.
  viewWidthPx: number
  coverageHeight: number
  sashimiArcsHeight: number
}

/**
 * Per-section sashimi arcs in stacking order, each group's junctions projected
 * into the two sub-bands with their content-space tops: `coverageOverlayTop`
 * for `up` arcs over the coverage histogram, `sashimiBandTop` for `down` arcs in
 * the strip below it. The side comes from the lane (`sashimiDownKeys`), and the
 * merge behind `sec.junctions` ran a computed earlier because it owes nothing to
 * the pan.
 */
export function computeSashimiArcSections(
  input: SashimiSectionsInput,
): SashimiArcSection[] {
  const { sections, ...opts } = input
  return sections.map(sec => ({
    groupKey: sec.groupKey,
    ...projectSashimiArcs(sec.junctions, {
      ...opts,
      downJunctionKeys: sec.sashimiDownKeys,
    }),
    coverageOverlayTop: sec.coverageTop + YSCALEBAR_LABEL_OFFSET,
    sashimiBandTop: sec.sashimiBandTop,
  }))
}
