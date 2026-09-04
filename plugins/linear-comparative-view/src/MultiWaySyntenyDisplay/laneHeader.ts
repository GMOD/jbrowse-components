import { getBpDisplayStr, toLocale } from '@jbrowse/core/util'

import { frameStartBp } from './layoutMultiWay.ts'

import type { Lane } from './laneStack.ts'

// Where the header text sits above its lane's glyph row.
export const LABEL_FONT_SIZE = 10
export const LABEL_BASELINE_OFFSET = 3

// `row.y` is a BASELINE, which is what SVG `<text>` takes. An HTML box is
// placed by its top, and a `line-height: 1` box puts its baseline this far
// below that — so the HTML half owes the conversion or its labels ride ~2px
// high against the export's. Same ratio and same reason as the MAF band
// labels: 0.84 is within a hair of both sans-serif faces in play.
export const LABEL_BASELINE_RATIO = 0.84

/** the top of a `line-height: 1` box whose baseline lands on `y` */
export function labelBoxTop(y: number) {
  return y - LABEL_FONT_SIZE * LABEL_BASELINE_RATIO
}

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
        `${lane.canon(lane.frame.refName)}:${toLocale(frameStartBp(lane.frame))}${lane.frame.flipped ? ' [rev]' : ''}`
    // the contigs the lane is NOT showing, named so the reader knows a second
    // copy exists and can pin the lane onto it from its menu
    const alsoOn = lane.frame?.alsoOn.length
      ? `· also on ${lane.frame.alsoOn.map(ref => lane.canon(ref)).join(', ')}`
      : undefined
    return {
      assemblyName: lane.assemblyName,
      label: [
        lane.assemblyName,
        where,
        alsoOn,
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
