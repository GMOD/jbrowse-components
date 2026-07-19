import type { TrackInit } from './types.ts'

// Resolve a session-spec `TrackInit` into the (trackId, trackSnapshot,
// displaySnapshot) triple that `showTrack` expects. Display props written
// inline on the track object (everything except trackId/trackSnapshot/
// displaySnapshot) fold into the display snapshot, so a spec can write
// `{ trackId, showDescriptions: false }` instead of nesting under
// `displaySnapshot`. An explicit `displaySnapshot` still wins over an inline
// key of the same name, and the older nested form keeps working unchanged.
// `showTrack`/`showTrackGeneric` then routes any inline key that is a real
// config slot (e.g. `forceLoad`) onto the display config, so a session spec can
// declaratively force-load a track with `{ trackId, forceLoad: true }`.
export function normalizeTrackInit(t: TrackInit) {
  if (typeof t === 'string') {
    return { trackId: t, trackSnapshot: {}, displaySnapshot: {} }
  } else {
    const { trackId, trackSnapshot, displaySnapshot, ...rest } = t
    return {
      trackId,
      trackSnapshot: trackSnapshot ?? {},
      displaySnapshot: { ...rest, ...displaySnapshot },
    }
  }
}
