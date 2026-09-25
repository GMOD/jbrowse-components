import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/wiggle-core/constants'

import { arcAvailH, arcYScale } from '../features/arcs/arcYScale.ts'
import { computeCrossRegionArcs } from '../features/arcs/crossRegionOverlay.ts'
import { projectSashimiArcs } from '../features/sashimi/computeOverlay.ts'

import type { CrossRegionArc } from '../features/arcs/arcTypes.ts'
import type { MergedJunction } from '../features/sashimi/junctions.ts'
import type { SashimiArcSection } from './components/sashimiArcs.ts'
import type { LaneSection } from './lanes.ts'
import type { ColorPalette } from './renderers/AlignmentsRenderer.ts'

/**
 * The three per-section overlay geometries, each a walk of `renderSections`
 * turning one lane's band into the marks drawn in it.
 *
 * They share a contract that is the reason they live together: every geometry
 * here is BAND-LOCAL and none of them reads `scrollTop`. Both hosts — the live
 * SVG overlay and the export — place the box at `bandScreenTop(bandTop, …)`, so
 * MobX replays the whole file's worth of computeds while a grouped track
 * scrolls. Putting a scroll offset into any of them is what would break that.
 *
 * They also share the gate: a lane whose reads produced no arc reserves no band
 * (`arcBandHeight === 0`) and therefore gets no ruler, no cross-region curve and
 * no strip — the same test the renderers use to skip the pass.
 */

// Only the section fields these three read. Narrower than `LaneSection` so a
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

type ArcBandSectionInput = Pick<
  LaneSection,
  'groupKey' | 'arcBandTop' | 'arcBandHeight' | 'arcDown'
>

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

export interface CrossRegionArcSectionsInput {
  sections: readonly (ArcBandSectionInput & {
    crossRegionArcs: readonly CrossRegionArc[]
  })[]
  bpToScreenX: (
    refName: string,
    bp: number,
    displayedRegionIndex: number,
  ) => number | undefined
  arcsYDomainBp: number | undefined
  // px per bp, which `arcYScale` needs to decide its regime. 0 for a view with
  // no scale yet.
  pxPerBp: number
  regionReversed: (displayedRegionIndex: number) => boolean
  regionScreenExtent: (
    displayedRegionIndex: number,
  ) => { left: number; right: number } | undefined
  lineWidth: number
  colors: ColorPalette
  // The whole track's width, `arcRadiiPx`' near/far threshold — see
  // `ArcBandFrame`.
  viewWidthPx: number
  // Said out loud rather than dropped silently, which is this repo's rule for a
  // cap — but the caller owns the reporting, because this runs inside a computed
  // that re-evaluates on every pan frame.
  onCapped: (groupKey: string, dropped: number, kept: number) => void
}

/**
 * Per-section geometry for the arcs no per-region pass can draw — the ones whose
 * two feet are in different displayed regions (`CrossRegionArc`).
 *
 * Empty in the single-region view, which is almost every view: the partition
 * upstream returns nothing there, so this costs one array read per section.
 */
export function computeCrossRegionArcSections(
  input: CrossRegionArcSectionsInput,
) {
  const {
    sections,
    bpToScreenX,
    arcsYDomainBp,
    pxPerBp,
    regionReversed,
    regionScreenExtent,
    lineWidth,
    colors,
    viewWidthPx,
    onCapped,
  } = input
  return sections.flatMap(sec => {
    const arcs = sec.crossRegionArcs
    if (arcs.length === 0 || sec.arcBandHeight <= 0) {
      return []
    }
    const { domainBp, log } = arcYScale(
      arcsYDomainBp,
      arcAvailH(sec.arcBandHeight),
      pxPerBp,
    )
    return [
      {
        groupKey: sec.groupKey,
        bandTop: sec.arcBandTop,
        bandHeight: sec.arcBandHeight,
        arcDown: sec.arcDown,
        arcs: computeCrossRegionArcs({
          arcs,
          bpToScreenX,
          frame: {
            arcsYDomainBp: domainBp,
            arcsYLog: log,
            // Band-local, so the host places the box rather than the path
            // carrying the section's offset.
            arcsTop: 0,
            arcsH: sec.arcBandHeight,
            pairedArcsDown: sec.arcDown,
            viewWidthPx,
          },
          regionReversed,
          regionScreenExtent,
          lineWidth,
          colors,
          onCapped: (dropped, kept) => {
            onCapped(sec.groupKey, dropped, kept)
          },
        }),
      },
    ]
  })
}
