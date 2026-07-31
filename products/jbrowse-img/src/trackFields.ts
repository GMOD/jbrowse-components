import type { Track } from './types.ts'

// A config track's `name`/`type` are typed `unknown` (Track is an open record),
// so read them through these guards rather than repeat the string check at each
// use. Shared by resolveTrackId/configTrackCategory (applyTrackOpts) and the
// `list` formatters.

export function trackName(track: Track) {
  return typeof track.name === 'string' ? track.name : ''
}

export function trackType(track: Track) {
  return typeof track.type === 'string' ? track.type : ''
}

// Substring match on a track's id or display name, case-insensitively. The one
// definition of "does this track match what the user typed", shared by the
// `list <hub> <filter>` search and the near-match suggestions resolveTrackId
// offers when a --track token misses, so both answer the same question.
export function trackMatches(track: Track, lowercaseNeedle: string) {
  return (
    track.trackId.toLowerCase().includes(lowercaseNeedle) ||
    trackName(track).toLowerCase().includes(lowercaseNeedle)
  )
}
