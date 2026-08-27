import { getBpDisplayStr, toLocale } from '@jbrowse/core/util'

import type { Lane } from './laneStack.ts'

// Where the header text sits above its lane's glyph row. The SVG half places a
// baseline here directly; the HTML half places a box's BOTTOM here, which is
// the same line once `lineHeight: 1` puts the baseline on it.
export const LABEL_FONT_SIZE = 10
export const LABEL_BASELINE_OFFSET = 3

export interface LaneHeaderRow {
  assemblyName: string
  /** the lane's name, where it is looking, and whether it has an annotation */
  label: string
  /** its span, and the anchor multiple where that is not 1 */
  scale: string
  /** the text baseline, in the stack's own px */
  y: number
  /** the anchor lane neither drags nor reorders */
  isAnchor: boolean
}

/**
 * What a lane's header says on the right: the span, because a range makes the
 * reader subtract two eight-digit numbers to answer "how zoomed is this lane",
 * and the multiple only where it is not 1 — so a stack of lanes at the anchor's
 * own scale says so by staying quiet. Against `visibleBpSpan`, which is the
 * unit the ladder rounded the lane's span to.
 */
function scaleLabelOf(lane: Lane, visibleBpSpan: number) {
  if (lane.isAnchor) {
    return visibleBpSpan > 0 ? getBpDisplayStr(visibleBpSpan) : ''
  }
  if (lane.frame === undefined) {
    return ''
  }
  const laneSpan = lane.frame.max - lane.frame.min
  const multiple = visibleBpSpan > 0 ? laneSpan / visibleBpSpan : 1
  return multiple > 1.02
    ? `${getBpDisplayStr(laneSpan)}  ${Number(multiple.toFixed(1))}×`
    : getBpDisplayStr(laneSpan)
}

/**
 * One row per lane, as strings and a y — everything both header presenters
 * need and nothing either of them owns.
 *
 * There are two presenters because the header is a CONTROL on screen (it
 * drags, it raises a menu) and CAPTION in an exported figure, and one component
 * cannot be both: SVG has no layout, so the menu affordance had to be placed by
 * a character-count estimate, and the affordance itself has no business in a
 * saved figure. The derivation is here rather than in either of them so the two
 * cannot come to say different things — the same reason `buildLanes` is on the
 * model rather than inside a render.
 */
export function laneHeaderRows(
  lanes: Lane[],
  visibleBpSpan: number,
  anchorWhere: string,
): LaneHeaderRow[] {
  return lanes.map(lane => {
    const where = lane.isAnchor
      ? anchorWhere
      : lane.frame &&
        `${lane.canon(lane.frame.refName)}:${toLocale(Math.round(lane.frame.min))}${lane.frame.flipped ? ' [rev]' : ''}`
    return {
      assemblyName: lane.assemblyName,
      label: [
        lane.assemblyName,
        where,
        lane.hasAnnotation ? undefined : '· no annotation',
      ]
        .filter(part => !!part)
        .join('  '),
      scale: scaleLabelOf(lane, visibleBpSpan),
      y: lane.glyphTop - LABEL_BASELINE_OFFSET,
      isAnchor: lane.isAnchor,
    }
  })
}
