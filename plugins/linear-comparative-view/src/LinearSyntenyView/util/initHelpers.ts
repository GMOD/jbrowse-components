// A spec's `tracks` accepts two shapes: a flat string[] is shorthand for "all
// on level 0", while string[][] is one entry per level (the gap between
// views[i] and views[i+1]). The type guard lets us branch without `as` casts on
// the union-of-arrays.
function isFlatTrackList(tracks: string[] | string[][]): tracks is string[] {
  return typeof tracks[0] === 'string'
}

export function normalizeTrackLevels(
  tracks: string[] | string[][],
): string[][] {
  return isFlatTrackList(tracks) ? [tracks] : tracks
}
