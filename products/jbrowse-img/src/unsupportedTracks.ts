import { trackType } from './trackFields.ts'

import type { Track } from './types.ts'

// jb2export bundles a fixed plugin set, but a --config/--hub is written for a
// JBrowse instance that may load more. The demo config's `cpgisland_ucsc_hg38`
// is a `UCSCAdapter` from an external plugin, and a view naming it lost the
// WHOLE render rather than that one lane: showTrackGeneric validates the config
// against the registered adapter union, the failure goes to session.notifyError,
// and renderRegion promotes the first error snackbar to a fatal. Every
// methylation figure in the docs carries that CpG-island track, so none of them
// could be exported at all.
//
// Skip-and-warn instead — the same bargain circularTrackIds already makes for a
// track with no chord display. The omission is on stderr, and the figure is the
// view minus what this build cannot draw, which beats no figure.

// The two registries this asks. Named structurally rather than as a
// PluginManager so the rules below are unit-testable without booting one; the
// real `pluginManager.trackTypes` / `.adapterTypes` satisfy it.
export interface TypeRegistries {
  trackTypes: { has: (name: string) => boolean }
  adapterTypes: { has: (name: string) => boolean }
}

// Every adapter config reachable from a track's `adapter`: the adapter itself,
// plus what nests under a key that names one — a MultiWiggleAdapter's
// `subadapters`, an alignments adapter's `sequenceAdapter`. Only those keys are
// followed. A `type` elsewhere in an adapter config belongs to that adapter's
// own vocabulary (an index's `indexType`, a location's `locationType`), and
// mistaking one for an unregistered adapter would skip a track that works.
function adapterConfigs(
  adapter: unknown,
  out: Record<string, unknown>[] = [],
): Record<string, unknown>[] {
  if (Array.isArray(adapter)) {
    for (const entry of adapter) {
      adapterConfigs(entry, out)
    }
  } else if (adapter && typeof adapter === 'object') {
    const conf = adapter as Record<string, unknown>
    out.push(conf)
    for (const [key, value] of Object.entries(conf)) {
      if (key === 'subadapters' || /[Aa]dapter$/.test(key)) {
        adapterConfigs(value, out)
      }
    }
  }
  return out
}

// Why this build cannot open a track, or undefined if it can. Deliberately
// narrow to "a type nothing registers": a config invalid for some OTHER reason
// is a bug in the config rather than a missing plugin, and still fails loudly.
export function unsupportedReason(track: Track, types: TypeRegistries) {
  const type = trackType(track)
  if (!types.trackTypes.has(type)) {
    return `no plugin here registers the track type "${type}"`
  }
  const missing = adapterConfigs(track.adapter)
    .map(conf => conf.type)
    .filter(name => typeof name === 'string' && !types.adapterTypes.has(name))
  return missing.length
    ? `no plugin here registers the adapter type "${missing[0]}"`
    : undefined
}

// Asked at each point that would open a track: is this one this build has no
// plugin for? Returns a predicate rather than a set of ids because the WARNING
// belongs here, at the moment a track is actually left out. Announcing the scan
// instead would name every unopenable track in the config — the JBrowse demo
// config has five, and a view that asks for one of them would report all five.
export type TrackSkipper = (trackId: string) => boolean

export function trackSkipper(
  tracks: Track[],
  types: TypeRegistries,
): TrackSkipper {
  const reasons = new Map<string, string>()
  for (const track of tracks) {
    const reason = unsupportedReason(track, types)
    if (reason !== undefined) {
      reasons.set(track.trackId, reason)
    }
  }
  const reported = new Set<string>()
  return trackId => {
    const reason = reasons.get(trackId)
    if (reason === undefined) {
      return false
    }
    if (!reported.has(trackId)) {
      reported.add(trackId)
      console.warn(
        `Warning: skipping track "${trackId}" — ${reason}, so it cannot be rendered here`,
      )
    }
    return true
  }
}

// One entry of a view init's track list: a bare trackId, or a trackId carrying
// the display snapshot to open it with.
function initTrackId(entry: unknown) {
  if (typeof entry === 'string') {
    return entry
  }
  const { trackId } = (entry ?? {}) as { trackId?: unknown }
  return typeof trackId === 'string' ? trackId : undefined
}

// Drop the skipped trackIds from a view init's `tracks`, at whatever depth the
// view keeps them: an LGV or circular init holds one flat list, a comparative
// view one list per level. An entry naming no track (or naming one that stays)
// is returned untouched, so nothing here has to know the rest of the snapshot's
// shape.
export function filterInitTracks<T>(tracks: T, skip: TrackSkipper): T {
  if (!Array.isArray(tracks)) {
    return tracks
  }
  const kept = tracks.filter(entry => {
    const trackId = initTrackId(entry)
    return trackId === undefined || !skip(trackId)
  })
  return kept.map(entry =>
    Array.isArray(entry) ? filterInitTracks(entry, skip) : entry,
  ) as T
}
