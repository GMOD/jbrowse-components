import { polarToCartesian } from '@jbrowse/core/util'

import { bpToRadians } from '../CircularView/slices.ts'
import { chordControlRadius } from './chordGeometry.ts'

import type { Slice } from '../CircularView/slices.ts'

/**
 * The narrowest a ribbon end is drawn, in pixels of arc.
 *
 * An alignment block is a span at both ends, which is the thing a chord throws
 * away and the reason these are ribbons — but most blocks are small against a
 * chromosome. A 5 kb PAF record on a 250 Mb chromosome is 2e-5 of the circle,
 * which rounds to a zero-width quad: invisible, and with nothing to point at.
 * Widening the end to a couple of pixels keeps the small records on the figure
 * and hittable, and costs nothing on the blocks big enough to read, whose ends
 * are already wider than this.
 */
export const minRibbonEndPx = 2

export interface RibbonSide {
  block: Slice
  start: number
  end: number
}

/**
 * A ribbon side's two angles, IN GENOMIC ORDER: `start` is where the span's
 * first base sits and `end` where its last does, so on a reversed slice `start`
 * is the larger of the two. Keeping the direction is what makes a mirrored
 * genome's ribbons read right — sorted low-to-high, a forward alignment onto a
 * reversed slice drew untwisted and an inversion drew as if it were forward.
 *
 * The span is floored at {@link minRibbonEndPx}, grown about where it sits and
 * outward in its own direction. An elided slice resolves both coordinates to its
 * midpoint, so the floor is also what keeps a ribbon into an elision drawn.
 */
export function ribbonEndRadians(
  { block, start, end }: RibbonSide,
  radius: number,
  minWidthPx = minRibbonEndPx,
) {
  const a = bpToRadians(block, start)
  const b = bpToRadians(block, end)
  const pad =
    Math.max(0, minWidthPx / Math.max(radius, 1) - Math.abs(b - a)) / 2
  const dir = b < a ? -1 : 1
  return { start: a - dir * pad, end: b + dir * pad }
}

/**
 * The four angles a ribbon's boundary visits, in the order it visits them:
 * along the anchor's arc, across to the mate, along the mate's arc, back.
 *
 * The strand is in that order and nowhere else. A forward alignment pairs the
 * two spans start-to-start, so the mate's arc is walked from its last base back
 * to its first and the two crossing curves do not cross; a reverse one pairs the
 * anchor's start with the mate's END, so the mate's arc is walked first-to-last
 * and the ribbon takes the twist that is how an inversion reads on a circle.
 * Both are the same statement about GENOMIC ends, which is why a mirrored slice
 * needs nothing here: `ribbonEndRadians` already answers in genomic order.
 */
export function ribbonAngles({
  anchor,
  mate,
  strand,
  radius,
  minWidthPx,
}: {
  anchor: RibbonSide
  mate: RibbonSide
  strand: number
  radius: number
  minWidthPx?: number
}) {
  const a = ribbonEndRadians(anchor, radius, minWidthPx)
  const m = ribbonEndRadians(mate, radius, minWidthPx)
  return strand === -1
    ? { a1: a.start, a2: a.end, m1: m.start, m2: m.end }
    : { a1: a.start, a2: a.end, m1: m.end, m2: m.start }
}

function point(radius: number, radians: number) {
  const [x, y] = polarToCartesian(radius, radians)
  return `${x} ${y}`
}

function arcTo(from: number, to: number, radius: number) {
  const largeArc = Math.abs(to - from) > Math.PI ? 1 : 0
  const sweep = to > from ? 1 : 0
  return `A ${radius} ${radius} 0 ${largeArc} ${sweep} ${point(radius, to)}`
}

function curveTo(
  from: number,
  to: number,
  radius: number,
  bezierRadius: number,
) {
  const control = chordControlRadius({
    startRadians: from,
    endRadians: to,
    radius,
    bezierRadius,
  })
  return `Q ${point(control, (from + to) / 2)} ${point(radius, to)}`
}

/**
 * One alignment as a closed ribbon: its span on the anchor's arc, a curve to
 * the mate, the mate's span, and a curve home. The curves bow toward the center
 * by the same rule the variant chords use, so a figure carrying both draws them
 * as one family.
 */
export function ribbonPath(opts: {
  anchor: RibbonSide
  mate: RibbonSide
  strand: number
  radius: number
  bezierRadius: number
  minWidthPx?: number
}) {
  const { radius, bezierRadius } = opts
  const { a1, a2, m1, m2 } = ribbonAngles(opts)
  return [
    `M ${point(radius, a1)}`,
    arcTo(a1, a2, radius),
    curveTo(a2, m1, radius, bezierRadius),
    arcTo(m1, m2, radius),
    curveTo(m2, a1, radius, bezierRadius),
    'Z',
  ].join(' ')
}
