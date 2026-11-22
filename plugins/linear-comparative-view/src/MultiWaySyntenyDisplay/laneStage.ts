import { doesIntersect2 } from '@jbrowse/core/util'
import { clipToDisplayedRegions } from '@jbrowse/core/util/Base1DUtils'

import {
  anchorPx,
  axisPlacement,
  axisSpan,
  axisSpans,
  displayedRegionSpans,
} from './anchorAxis.ts'
import { decideLaneFrames, frameFromDecision } from './laneDecision.ts'
import { buildLanes } from './laneStack.ts'
import { clipGroupToAnchor } from './layoutMultiWay.ts'

import type { AlignmentOpsById } from './alignmentOps.ts'
import type { AnchorLayout } from './anchorAxis.ts'
import type {
  AnchorCoord,
  DecideLaneFramesOpts,
  LaneDecision,
} from './laneDecision.ts'
import type { BuildLanesOpts } from './laneStack.ts'
import type {
  LaneOpening,
  MultiWayGroup,
  PlacedGroup,
  Span,
} from './layoutMultiWay.ts'

/**
 * The anchor lane as the lanes place against it: the display's view at the
 * zoom it decides or draws at, or a static layout of the regions an export
 * reads. Every lane decision, frame and stack goes through one, so the display
 * and `multiwayTables` place lanes alike.
 */
export interface AnchorStage {
  layout: AnchorLayout
  /** view px the stack lays out against */
  originPx: number
  width: number
  anchorReversed: boolean
  /** an anchor refName as the layout's regions spell it */
  canon: (refName: string) => string
}

function stagePx({ layout, originPx }: AnchorStage, coord: AnchorCoord) {
  const px = anchorPx(layout, coord.refName, coord.coord)
  return px === undefined ? undefined : px - originPx
}

/**
 * The groups the window's regions meet: `shown` cut only at a displayed
 * region's end, and `fit` cut to the hull of the window regions each meets,
 * which each lane's frame fits
 */
export function windowGroupsOn(
  { layout, canon }: Pick<AnchorStage, 'layout' | 'canon'>,
  groups: readonly MultiWayGroup[],
  windowRegions: readonly { refName: string; start: number; end: number }[],
  ops: AlignmentOpsById,
) {
  const shown: MultiWayGroup[] = []
  const fit: MultiWayGroup[] = []
  for (const group of groups) {
    const { start, end } = group.anchor
    const refName = canon(group.anchor.refName)
    const met = windowRegions.filter(
      r => r.refName === refName && doesIntersect2(r.start, r.end, start, end),
    )
    if (met.length) {
      const displayed = clipToDisplayedRegions(layout, { refName, start, end })
      shown.push(
        displayed
          ? clipGroupToAnchor(group, displayed.start, displayed.end, ops)
          : group,
      )
      fit.push(
        clipGroupToAnchor(
          group,
          met.reduce((lo, r) => Math.min(lo, r.start), Infinity),
          met.reduce((hi, r) => Math.max(hi, r.end), -Infinity),
          ops,
        ),
      )
    }
  }
  return { shown, fit }
}

/** Each anchored group's span in px relative to the stage's origin. */
export function anchorSpansOn(
  { layout, originPx, canon }: AnchorStage,
  groups: readonly PlacedGroup[],
) {
  const out = new Map<string, Span>()
  for (const { key, anchor } of groups) {
    const span =
      anchor &&
      axisSpan(
        layout,
        canon(anchor.refName),
        anchor.start,
        anchor.end,
        originPx,
      )
    if (span) {
      out.set(key, span)
    }
  }
  return out
}

/** Each anchored group's centre, in view px before the scroll offset. */
export function anchorCentresOn(
  { layout, canon }: AnchorStage,
  groups: readonly PlacedGroup[],
) {
  const out = new Map<string, { coord: AnchorCoord; x: number }>()
  for (const { key, anchor } of groups) {
    const placement =
      anchor &&
      axisPlacement(layout, canon(anchor.refName), anchor.start, anchor.end)
    if (placement) {
      out.set(key, {
        coord: placement.centre,
        x: (placement.x1 + placement.x2) / 2,
      })
    }
  }
  return out
}

/**
 * `decideLaneFrames` with the anchor's placements read off the stage, the
 * mate lanes in draw order with `anchorRow` of them above the anchor: each
 * side decides outward from it
 */
export function decideLanesOn(
  stage: AnchorStage,
  {
    assemblyNames,
    anchorRow = 0,
    ...opts
  }: Pick<
    DecideLaneFramesOpts,
    'assemblyNames' | 'previous' | 'frozen' | 'pins' | 'openingsOf' | 'vsAnchor'
  > & { groups: MultiWayGroup[]; anchorRow?: number },
) {
  const { layout, originPx, width, anchorReversed } = stage
  const centres = anchorCentresOn(stage, opts.groups)
  const decide = (outward: string[]) =>
    decideLaneFrames({
      ...opts,
      assemblyNames: outward,
      anchorX: new Map([...centres].map(([key, { x }]) => [key, x - originPx])),
      anchorCoordOf: group => centres.get(group.key)!.coord,
      pxOfAnchor: coord => stagePx(stage, coord),
      unitBp: width * layout.bpPerPx,
      width,
      anchorReversed,
    })
  const below = decide(assemblyNames.slice(anchorRow))
  return anchorRow > 0
    ? new Map([
        ...decide(assemblyNames.slice(0, anchorRow).reverse()),
        ...below,
      ])
    : below
}

/** undefined once the pivot is off the displayed regions */
export function laneFrameOn(
  stage: AnchorStage,
  decision: LaneDecision,
  openings: readonly LaneOpening[],
) {
  const pivot = stagePx(stage, decision.pivotAnchor)
  return pivot === undefined
    ? undefined
    : frameFromDecision(
        decision,
        pivot,
        stage.width * stage.layout.bpPerPx,
        stage.width,
        stage.anchorReversed,
        openings,
      )
}

/** `buildLanes` with the anchor lane read off the stage */
export function laneStackOn(
  stage: AnchorStage,
  opts: Omit<
    BuildLanesOpts,
    | 'anchorSpans'
    | 'axisSpanOf'
    | 'axisSpansOf'
    | 'anchorRegionSpans'
    | 'anchorBpPerPx'
    | 'width'
  >,
) {
  const { layout, originPx, width } = stage
  return buildLanes({
    ...opts,
    anchorSpans: anchorSpansOn(stage, opts.groups),
    axisSpanOf: (refName, start, end) =>
      axisSpan(layout, refName, start, end, originPx),
    axisSpansOf: (refName, start, end) =>
      axisSpans(layout, refName, start, end, originPx),
    anchorRegionSpans: displayedRegionSpans(layout, originPx),
    anchorBpPerPx: layout.bpPerPx,
    width,
  })
}
