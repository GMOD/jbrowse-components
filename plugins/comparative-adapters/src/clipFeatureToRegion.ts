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

interface Piece extends ClippedIntervals {
  suffix: string
}

function clipIntervals(
  feature: Feature,
  mate: Interval,
  window: Interval,
  splitAtGapBp: number | undefined,
): Piece[] {
  const own = { start: feature.get('start'), end: feature.get('end') }
  const strand = feature.get('strand') === -1 ? -1 : 1
  const holds = (i: Interval) => i.start >= window.start && i.end <= window.end
  const windowSuffix = `:${window.start}-${window.end}`
  const ops =
    holds(own) && splitAtGapBp === undefined
      ? undefined
      : getAlignmentOps(feature)
  if (ops === undefined) {
    if (holds(own)) {
      return [{ ...own, mateStart: mate.start, mateEnd: mate.end, suffix: '' }]
    }
    const clipped = interpolateClip(own, mate, strand, window)
    return clipped === undefined ? [] : [{ ...clipped, suffix: windowSuffix }]
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
    return runs.flatMap((run, i) => {
      const clipped = clipSyntenyFeature(
        run.cigar,
        run.start,
        run.mateStart,
        run.mateEnd,
        strand,
        window.start,
        window.end,
      )
      if (clipped === undefined) {
        return []
      }
      const numbered = runs.length > 1 ? `/${i}` : ''
      return [
        { ...clipped, suffix: `${holds(run) ? '' : windowSuffix}${numbered}` },
      ]
    })
  }
}

function clippedFeature(
  feature: Feature,
  mate: SerializedMate,
  { suffix, ...clipped }: Piece,
) {
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
 * expensive to ship.
 *
 * A piece the window cuts names the window in its ids, so the pieces one
 * record leaves in two regions stay two features. A record or run the window
 * holds whole keeps its own id, so it is the same feature in every window
 * that holds it, and a selection keyed on it survives a refetch. Runs are
 * numbered by their place in the record, and `syntenyId` carries the same
 * suffix, so each run is its own group to a display grouping on it — one
 * placement per run rather than one ribbon across the gap. A feature with no
 * `mate` is not a pairwise record and passes through whole.
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
    return clipIntervals(feature, mate, window, splitAtGapBp).map(piece =>
      clippedFeature(feature, mate, piece),
    )
  }
}
