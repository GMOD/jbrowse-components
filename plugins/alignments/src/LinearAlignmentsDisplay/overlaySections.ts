import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/wiggle-core/constants'

import { arcAvailH, arcYScale } from '../features/arcs/arcYScale.ts'
import { computeCrossRegionArcs } from '../features/arcs/crossRegionOverlay.ts'
import { computeSashimiArcs } from '../features/sashimi/computeOverlay.ts'
import { splitArcsBySide } from './components/sashimiArcs.ts'
import { computeInsertSizeTicks } from './insertSizeTicks.ts'

import type { CrossRegionArc } from '../features/arcs/arcTypes.ts'
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
type SashimiSectionInput = Pick<
  LaneSection,
  | 'groupKey'
  | 'rawPileupMap'
  | 'sashimiDownKeys'
  | 'coverageTop'
  | 'sashimiBandTop'
>

type ArcBandSectionInput = Pick<
  LaneSection,
  'groupKey' | 'arcBandTop' | 'arcBandHeight' | 'arcDown'
>

export interface SashimiSectionsInput {
  sections: readonly SashimiSectionInput[]
  visibleRegions: { refName: string; displayedRegionIndex: number }[]
  bpToScreenX: (refName: string, bp: number) => number | undefined
  // The view's width — the overlay sizes its `<svg>` with it and the export
  // paints at `canvasWidth`, which `renderDisplaySvg` resolves to `view.width`
  // for every LGV display.
  viewWidthPx: number
  coverageHeight: number
  sashimiArcsHeight: number
  minSashimiScore: number
}

/**
 * Per-section sashimi arcs, in stacking order: each group's junction geometry
 * (sashimi counts live per group) already split into the two sub-bands, paired
 * with their content-space tops — `coverageOverlayTop` for `up` arcs drawn over
 * the coverage histogram, `sashimiBandTop` for `down` arcs in the reserved strip
 * below it. In 'auto' both are populated; 'up'/'down' leave the other empty.
 *
 * Which side each arc takes was decided once, in genomic bp, by
 * `sashimiDownKeysByGroup` — this reads the lane's answer rather than a second
 * one in screen space.
 */
export function computeSashimiArcSections(
  input: SashimiSectionsInput,
): SashimiArcSection[] {
  const { sections, ...opts } = input
  return sections.map(sec => {
    const arcs = computeSashimiArcs({
      ...opts,
      rpcDataMap: sec.rawPileupMap,
      downJunctionKeys: sec.sashimiDownKeys,
    })
    // Already ascending by score — `computeSashimiArcs` emits them that way, and
    // `computeOverlay.test.ts` pins it. The sort used to be one call up from the
    // array's producer, which is why it read as missing to anyone looking at the
    // producer.
    return {
      groupKey: sec.groupKey,
      ...splitArcsBySide(arcs),
      coverageOverlayTop: sec.coverageTop + YSCALEBAR_LABEL_OFFSET,
      sashimiBandTop: sec.sashimiBandTop,
    }
  })
}

/**
 * The read cloud's insert-size ruler, ONE PER SECTION that reserves an arc band,
 * in stacking order.
 *
 * Per section for the same reason `CoverageScaleBars` is: arc strips are
 * reserved per section, so a grouped read cloud has N bands and a single ruler
 * can only sit beside one of them. It sat beside the first — the values were
 * right for every lane, since `arcsYDomainBp` is pooled across groups, but every
 * lane below the first had a plotted axis and nothing labelling it.
 *
 * The band comes off the placed section, which carries `computeArcBand`'s answer
 * already at the section's own `coverageTop`, rather than from a second
 * `computeArcBand` call that could only describe a section-relative band. So the
 * tick `y`s are absolute CONTENT y, and the one `bandScreenTop(0, …)` shift both
 * hosts already apply completes the projection — `bandScreenTop` being linear in
 * its argument, that is exactly `bandScreenTop(sec.arcBandTop, …)`.
 */
export function computeInsertSizeTickSections(
  sections: readonly ArcBandSectionInput[],
  arcsYDomainBp: number,
) {
  return sections.flatMap(sec => {
    // A lane whose reads produced no arc reserves no band, so it gets no ruler —
    // the same gate the renderers use to skip the pass.
    const ticks =
      sec.arcBandHeight > 0
        ? computeInsertSizeTicks({
            band: {
              top: sec.arcBandTop,
              height: sec.arcBandHeight,
              down: sec.arcDown,
            },
            arcsYDomainBp,
          })
        : undefined
    return ticks ? [{ groupKey: sec.groupKey, ticks }] : []
  })
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
  lineWidth: number
  colors: ColorPalette
  // The WHOLE VIEW's width — see `ComputeCrossRegionArcsOpts`, which says why
  // this is the one consumer that must not use a block's.
  screenWidthPx: number
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
    lineWidth,
    colors,
    screenWidthPx,
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
            screenWidthPx,
          },
          regionReversed,
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
