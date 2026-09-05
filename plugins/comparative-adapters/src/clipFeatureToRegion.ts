import { clipSyntenyFeature, getAlignmentOps } from '@jbrowse/synteny-core'

import SyntenyFeature from './SyntenyFeature/index.ts'

import type { Feature, SimpleFeatureSerialized } from '@jbrowse/core/util'

interface Interval {
  start: number
  end: number
}

interface ClippedIntervals extends Interval {
  mateStart: number
  mateEnd: number
}

const ALIGNMENT_STRING_FIELDS = ['CIGAR', 'cs', 'coarseCigar', 'cg', 'cr']

type SerializedMate = NonNullable<SimpleFeatureSerialized['mate']>

function isMate(mate: unknown): mate is SerializedMate {
  return (
    typeof mate === 'object' &&
    mate !== null &&
    'refName' in mate &&
    'start' in mate &&
    'end' in mate &&
    typeof mate.refName === 'string' &&
    typeof mate.start === 'number' &&
    typeof mate.end === 'number'
  )
}

function mateOf(feature: Feature) {
  const mate: unknown = feature.get('mate')
  return isMate(mate) ? mate : undefined
}

// A record with no alignment string maps its two intervals onto each other in
// proportion, the way the synteny launch interpolates across such a block; a
// reverse-strand record runs its mate from the far end.
function interpolateClip(
  own: Interval,
  mate: Interval,
  strand: number,
  window: Interval,
): ClippedIntervals | undefined {
  const lo = Math.max(own.start, window.start)
  const hi = Math.min(own.end, window.end)
  const ratio = (mate.end - mate.start) / Math.max(own.end - own.start, 1)
  const mateAt = (q: number) =>
    strand === -1
      ? mate.end - (q - own.start) * ratio
      : mate.start + (q - own.start) * ratio
  const a = Math.round(mateAt(lo))
  const b = Math.round(mateAt(hi))
  return hi > lo
    ? { start: lo, end: hi, mateStart: Math.min(a, b), mateEnd: Math.max(a, b) }
    : undefined
}

function clipIntervals(
  feature: Feature,
  mate: Interval,
  window: Interval,
): ClippedIntervals | undefined {
  const own = { start: feature.get('start'), end: feature.get('end') }
  const strand = feature.get('strand') === -1 ? -1 : 1
  const inside = own.start >= window.start && own.end <= window.end
  const ops = inside ? undefined : getAlignmentOps(feature)
  return inside
    ? { ...own, mateStart: mate.start, mateEnd: mate.end }
    : ops === undefined
      ? interpolateClip(own, mate, strand, window)
      : clipSyntenyFeature(
          ops,
          own.start,
          mate.start,
          mate.end,
          strand,
          window.start,
          window.end,
        )
}

function clippedFeature(
  feature: Feature,
  mate: SerializedMate,
  clipped: ClippedIntervals,
  window: Interval,
) {
  const suffix = `:${window.start}-${window.end}`
  const source = feature.toJSON()
  const data: SimpleFeatureSerialized = {
    ...source,
    uniqueId: `${feature.id()}${suffix}`,
    start: clipped.start,
    end: clipped.end,
    mate: { ...mate, start: clipped.mateStart, end: clipped.mateEnd },
  }
  if (source.syntenyId !== undefined) {
    data.syntenyId = `${String(source.syntenyId)}${suffix}`
  }
  for (const field of ALIGNMENT_STRING_FIELDS) {
    delete data[field]
  }
  return new SyntenyFeature(data)
}

/**
 * The piece of one pairwise record inside `window`, on both axes, or undefined
 * when none of it is. The piece keeps every field of the record except the
 * alignment strings, which are what made the whole record expensive to ship,
 * and its ids name the window so the pieces one record leaves in two regions
 * stay two features. A feature with no `mate` is not a pairwise record and
 * passes through whole.
 */
export function clipFeatureToRegion(feature: Feature, window: Interval) {
  const mate = mateOf(feature)
  const clipped =
    mate === undefined ? undefined : clipIntervals(feature, mate, window)
  return mate === undefined
    ? feature
    : clipped === undefined
      ? undefined
      : clippedFeature(feature, mate, clipped, window)
}
