import { svMateLocus } from '@jbrowse/sv-core'

import type { Slice } from '../CircularView/slices.ts'
import type { Feature } from '@jbrowse/core/util'

/**
 * How far from the center a chord's Bezier control point sits, which is what
 * decides how deeply the chord bows inward.
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
 * chord keeps the full `bezierRadius` bow it has always had, a local event
 * collapses to a point at the rim instead of a spoke, and the range between
 * them bows in proportion. Past half the circle the separation stops growing,
 * hence the clamp.
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
  const sweep = Math.min(Math.abs(endRadians - startRadians), Math.PI)
  return radius - (radius - bezierRadius) * Math.sin(sweep / 2)
}

/**
 * The slice+position a chord's far end lands on: the record's mate where it
 * names one, else the feature's own end — which for anything but a breakend is
 * where the chord degenerates to a point.
 */
export function getEndpoint(
  feature: Feature,
  blocksForRefs: Record<string, Slice>,
  startBlock: Slice,
) {
  const mate = svMateLocus(feature)
  return mate
    ? { endBlock: blocksForRefs[mate.refName], endPosition: mate.pos }
    : { endBlock: startBlock, endPosition: feature.get('end') }
}
