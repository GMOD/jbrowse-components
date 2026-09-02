import type { SyntenyTrackInit } from '../types.ts'

// A spec's `tracks` accepts two shapes: a flat list is shorthand for "all on
// level 0", while a nested one is one entry per level (the gap between views[i]
// and views[i+1]).
function isFlatTrackList(
  tracks: SyntenyTrackInit[] | SyntenyTrackInit[][],
): tracks is SyntenyTrackInit[] {
  return tracks.length > 0 && !Array.isArray(tracks[0])
}

export function normalizeTrackLevels(
  tracks: SyntenyTrackInit[] | SyntenyTrackInit[][],
) {
  return isFlatTrackList(tracks) ? [tracks] : tracks
}
