import {
  anchorPx,
  axisPlacement,
  axisSpan,
  axisSpans,
  displayedRegionSpans,
} from './anchorAxis.ts'
import { decideLaneFrames, frameFromDecision } from './laneDecision.ts'
import { buildLanes } from './laneStack.ts'

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

/** `decideLaneFrames` with the anchor's placements read off the stage */
export function decideLanesOn(
  stage: AnchorStage,
  opts: Pick<
    DecideLaneFramesOpts,
    'assemblyNames' | 'previous' | 'frozen' | 'pins' | 'openingsOf'
  > & { groups: MultiWayGroup[] },
) {
  const { layout, originPx, width, anchorReversed } = stage
  const centres = anchorCentresOn(stage, opts.groups)
  return decideLaneFrames({
    ...opts,
    anchorX: new Map([...centres].map(([key, { x }]) => [key, x - originPx])),
    anchorCoordOf: group => centres.get(group.key)!.coord,
    pxOfAnchor: coord => stagePx(stage, coord),
    unitBp: width * layout.bpPerPx,
    width,
    anchorReversed,
  })
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
    axisSpanOf: (refName, start, end) =>
      axisSpan(layout, refName, start, end, originPx),
    axisSpansOf: (refName, start, end) =>
      axisSpans(layout, refName, start, end, originPx),
    anchorRegionSpans: displayedRegionSpans(layout, originPx),
    anchorBpPerPx: layout.bpPerPx,
    width,
  })
}
