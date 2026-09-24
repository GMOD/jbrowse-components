import { polarToCartesian } from '@jbrowse/core/util'
import { svMateLocus } from '@jbrowse/sv-core'

import { bpToRadians } from '../CircularView/slices.ts'

import type { Slice } from '../CircularView/slices.ts'
import type { Feature } from '@jbrowse/core/util'

/** The signed turn from `from` to `to` the short way round, in [-π, π]. */
function shortTurn(from: number, to: number) {
  const turn = (to - from) % (2 * Math.PI)
  return turn > Math.PI
    ? turn - 2 * Math.PI
    : turn < -Math.PI
      ? turn + 2 * Math.PI
      : turn
}

/**
 * How far from the center a chord's Bezier control point sits, which sets how
 * deeply the chord bows inward.
 *
 * Scaled by how far apart the chord's two ends are, because a fixed depth is
 * only right for the widest chord. Every intrachromosomal event puts both ends
 * at essentially one angle, and a control point pinned near the center then
 * drew it as a full-depth radial spoke — rim, in to the middle, back out to the
 * same place. At whole-genome scale that is most of a real callset: 171 of the
 * 210 calls in the C-GIAB somatic benchmark have their two ends less than a
 * pixel apart, so the spokes buried the 39 chords that carry information.
 *
 * `sin(sweep/2)` is the endpoints' straight-line distance over the diameter, so
 * the depth follows the chord the curve is actually drawn across: an antipodal
 * chord keeps the full `bezierRadius` bow, a local event collapses to a point
 * at the rim instead of a spoke, and the range between them bows in
 * proportion. The sweep is the short way round, so two ends either side of the
 * circle's first angle are as close as they look.
 */
export function chordControlRadius({
  startRadians,
  endRadians,
  radius,
  bezierRadius,
}: {
  startRadians: number
  endRadians: number
  radius: number
  bezierRadius: number
}) {
  const sweep = Math.abs(shortTurn(startRadians, endRadians))
  return radius - (radius - bezierRadius) * Math.sin(sweep / 2)
}

/** A chord's Bezier control point, on the bisector of its short arc. */
export function chordControlPoint(opts: {
  startRadians: number
  endRadians: number
  radius: number
  bezierRadius: number
}) {
  const { startRadians, endRadians } = opts
  return polarToCartesian(
    chordControlRadius(opts),
    startRadians + shortTurn(startRadians, endRadians) / 2,
  )
}

/**
 * The slice+position a chord's far end lands on: the record's mate where it
 * names one, else the feature's own end — which for anything but a breakend is
 * where the chord degenerates to a point.
 */
export function getEndpoint(
  feature: Feature,
  sliceForRef: (refName: string) => Slice | undefined,
  startBlock: Slice,
) {
  const mate = svMateLocus(feature)
  return mate
    ? { endBlock: sliceForRef(mate.refName), endPosition: mate.pos }
    : { endBlock: startBlock, endPosition: feature.get('end') }
}

/**
 * A chord's SVG path, or undefined when there is nothing to draw: an end on a
 * region the circle is not showing, or two ends under a pixel apart. The second
 * is every deletion and insertion of a whole-genome callset. Such a stroke is
 * an antialiased speck on the rim, under the ideogram, and a path per record is
 * a DOM node each, which the browser lays out and paints one by one.
 */
export function chordPath({
  feature,
  sliceFor,
  radius,
  bezierRadius,
}: {
  feature: Feature
  sliceFor: (refName: string) => Slice | undefined
  radius: number
  bezierRadius: number
}) {
  const startBlock = sliceFor(feature.get('refName'))
  if (!startBlock) {
    return undefined
  }
  const { endBlock, endPosition } = getEndpoint(feature, sliceFor, startBlock)
  if (!endBlock) {
    return undefined
  }
  const startRadians = bpToRadians(startBlock, feature.get('start'))
  const endRadians = bpToRadians(endBlock, endPosition)
  if (Math.abs(shortTurn(startRadians, endRadians)) * radius < 1) {
    return undefined
  }
  const [x1, y1] = polarToCartesian(radius, startRadians)
  const [x2, y2] = polarToCartesian(radius, endRadians)
  const [cx, cy] = chordControlPoint({
    startRadians,
    endRadians,
    radius,
    bezierRadius,
  })
  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`
}
