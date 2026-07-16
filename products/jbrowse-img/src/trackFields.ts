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
