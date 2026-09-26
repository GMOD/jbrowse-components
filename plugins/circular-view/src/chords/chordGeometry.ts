import { polarToCartesian } from '@jbrowse/core/util'
import { svMateLocus } from '@jbrowse/sv-core'

import { chordTurn } from './shaders/chordStage.js.generated.ts'

import type { ChordEnds } from './chordStage.ts'
import type { PathSink } from './pathSink.ts'
import type { Feature } from '@jbrowse/core/util'

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
  const sweep = Math.abs(chordTurn(startRadians, endRadians))
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
    startRadians + chordTurn(startRadians, endRadians) / 2,
  )
}

/**
 * The slice+position a chord's far end lands on: the record's mate where it
 * names one, else the feature's own end — which for anything but a breakend is
 * where the chord degenerates to a point.
 */
export function getEndpoint<S>(
  feature: Feature,
  sliceForRef: (refName: string) => S | undefined,
  startBlock: S,
) {
  const mate = svMateLocus(feature)
  return mate
    ? { endBlock: sliceForRef(mate.refName), endPosition: mate.pos }
    : { endBlock: startBlock, endPosition: feature.get('end') }
}

/** A chord's outline: from one end, bowing through the control point, to the other. */
export function traceChord(
  sink: PathSink,
  { startRadians, endRadians }: ChordEnds,
  radius: number,
  bezierRadius: number,
) {
  const [cx, cy] = chordControlPoint({
    startRadians,
    endRadians,
    radius,
    bezierRadius,
  })
  sink.moveTo(radius, startRadians)
  sink.quadTo(cx, cy, radius, endRadians)
}
