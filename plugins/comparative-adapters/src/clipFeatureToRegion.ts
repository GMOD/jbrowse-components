import {
  clipSyntenyFeature,
  getAlignmentOps,
  splitSyntenyFeatureAtGaps,
} from '@jbrowse/synteny-core'

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

// A record inside the window is its own clip, and skips parsing its
// alignment string — unless the runs are wanted, which only the string knows.
function clipIntervals(
  feature: Feature,
  mate: Interval,
  window: Interval,
  splitAtGapBp: number | undefined,
): ClippedIntervals[] {
  const own = { start: feature.get('start'), end: feature.get('end') }
  const strand = feature.get('strand') === -1 ? -1 : 1
  const inside = own.start >= window.start && own.end <= window.end
  const ops =
    inside && splitAtGapBp === undefined ? undefined : getAlignmentOps(feature)
  if (ops === undefined) {
    const clipped = inside
      ? { ...own, mateStart: mate.start, mateEnd: mate.end }
      : interpolateClip(own, mate, strand, window)
    return clipped === undefined ? [] : [clipped]
  } else {
    const runs =
      splitAtGapBp === undefined
        ? [{ ...own, mateStart: mate.start, mateEnd: mate.end, cigar: ops }]
        : splitSyntenyFeatureAtGaps(
            ops,
            own.start,
            mate.start,
            mate.end,
            strand,
            splitAtGapBp,
          )
    return runs.flatMap(run => {
      const clipped = clipSyntenyFeature(
        run.cigar,
        run.start,
        run.mateStart,
        run.mateEnd,
        strand,
        window.start,
        window.end,
      )
      return clipped === undefined ? [] : [clipped]
    })
  }
}

function clippedFeature(
  feature: Feature,
  mate: SerializedMate,
  clipped: ClippedIntervals,
  window: Interval,
  run: string,
) {
  const suffix = `:${window.start}-${window.end}${run}`
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
 * The pieces of one pairwise record inside `window`, on both axes: none when
 * the record misses the window, one otherwise, and with `splitAtGapBp` one per
 * gap-free run of its alignment. A piece keeps every field of the record
 * except the alignment strings, which are what made the whole record
 * expensive to ship, and its ids name the window so the pieces one record
 * leaves in two regions stay two features; the runs of one window are
 * numbered after it, so each is its own feature and — since `syntenyId`
 * carries the same suffix — its own group to a display grouping on it, which
 * is what draws each run as its own placement rather than one ribbon across
 * the gap. A feature with no `mate` is not a pairwise record and passes
 * through whole.
 */
export function clipFeatureToRegion(
  feature: Feature,
  window: Interval,
  splitAtGapBp?: number,
): Feature[] {
  const mate = mateOf(feature)
  if (mate === undefined) {
    return [feature]
  } else {
    const pieces = clipIntervals(feature, mate, window, splitAtGapBp)
    return pieces.map((piece, i) =>
      clippedFeature(
        feature,
        mate,
        piece,
        window,
        pieces.length > 1 ? `/${i}` : '',
      ),
    )
  }
}
