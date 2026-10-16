import { getConfAssemblyNamesOrNone } from '@jbrowse/core/util/tracks'

import type { AnyTrackConfig } from '@jbrowse/core/configuration'

// Ranked, not a set: a flat set would pick a BED repeat track over GFF3 genes.
const ANNOTATION_ADAPTER_RANK = [
  ['Gff3Adapter', 'Gff3TabixAdapter'],
  ['GtfAdapter', 'GtfTabixAdapter'],
  ['BigBedAdapter', 'BedTabixAdapter', 'BedAdapter'],
  ['NCListAdapter', 'FromConfigAdapter', 'SPARQLAdapter'],
]

/** lower is better; `undefined` for a type that is not gene annotation */
export function annotationRank(type: string | undefined) {
  if (type === undefined) {
    return undefined
  }
  const rank = ANNOTATION_ADAPTER_RANK.findIndex(tier => tier.includes(type))
  return rank < 0 ? undefined : rank
}

export interface LaneGeneTracksInputs {
  lanes: readonly string[]
  keyOf: (lane: string) => string
  tracks: Iterable<AnyTrackConfig>
  namedTracks: (key: string) => AnyTrackConfig[]
}

/**
 * Each lane's gene track, keyed by the lane's own spelling: the one the
 * config names for its genome, else the best-ranked single-assembly annotation
 * track.
 */
export function laneGeneTracksOf({
  lanes,
  keyOf,
  tracks,
  namedTracks,
}: LaneGeneTracksInputs) {
  const lanesByKey = new Map<string, string[]>()
  for (const lane of lanes) {
    const key = keyOf(lane)
    lanesByKey.set(key, [...(lanesByKey.get(key) ?? []), lane])
  }
  const best = new Map<string, { rank: number; track: AnyTrackConfig }>()
  for (const track of tracks) {
    const names = getConfAssemblyNamesOrNone(track)
    const type = (track.adapter as { type?: unknown } | undefined)?.type
    const rank = annotationRank(typeof type === 'string' ? type : undefined)
    if (names.length === 1 && rank !== undefined) {
      const key = keyOf(names[0]!)
      const held = best.get(key)
      if (lanesByKey.has(key) && (held === undefined || rank < held.rank)) {
        best.set(key, { rank, track })
      }
    }
  }
  const out = new Map<string, AnyTrackConfig>()
  for (const [key, keyLanes] of lanesByKey) {
    const track =
      namedTracks(key).find(t => getConfAssemblyNamesOrNone(t).length === 1) ??
      best.get(key)?.track
    if (track) {
      for (const lane of keyLanes) {
        out.set(lane, track)
      }
    }
  }
  return out
}
