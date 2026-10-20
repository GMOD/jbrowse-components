import type { Track } from './fileInput.ts'

// A config track's `name`/`type` are typed `unknown` (Track is an open record),
// so read them through these guards rather than repeat the string check at each
// use.
//
// No `node:` imports here: JBrowse Desktop's renderer resolves a --track token
// with this module, through the `@jbrowse/launch-args/trackIds` subpath.

export function trackName(track: Track) {
  return typeof track.name === 'string' ? track.name : ''
}

export function trackType(track: Track) {
  return typeof track.type === 'string' ? track.type : ''
}

// Substring match on a track's id or display name, case-insensitively. The one
// definition of "does this track match what the user typed", shared by the
// `list <genome> <filter>` search and the near-match suggestions resolveTrackId
// offers when a --track token misses, so both answer the same question.
export function trackMatches(track: Track, lowercaseNeedle: string) {
  return (
    track.trackId.toLowerCase().includes(lowercaseNeedle) ||
    trackName(track).toLowerCase().includes(lowercaseNeedle)
  )
}

function matchTrackId(tracks: Track[], input: string, assemblyName: string) {
  const ids = new Set(tracks.map(t => t.trackId))
  const prefixed = `${assemblyName}-${input}`
  const target = input.toLowerCase()
  const prefix = `${assemblyName}-`.toLowerCase()
  const looseMatches = tracks.filter(t => {
    const id = t.trackId.toLowerCase()
    const unprefixed = id.startsWith(prefix) ? id.slice(prefix.length) : id
    return (
      id === target ||
      unprefixed === target ||
      trackName(t).toLowerCase() === target
    )
  })

  const resolved = ids.has(input)
    ? input
    : ids.has(prefixed)
      ? prefixed
      : looseMatches.length === 1
        ? looseMatches[0]!.trackId
        : undefined
  return { resolved, looseMatches }
}

// Resolve a user's --track token to a real trackId in the config. Hosted
// trackIds are all prefixed with the assembly name (e.g. hg19-ncbiRefSeqCurated),
// which is tedious to type, so this accepts: the exact id, the id with the
// `<assembly>-` prefix dropped, or a case-insensitive match on the id or the
// track's display name (when unambiguous). A miss throws with near-matches so the
// user can correct the token rather than getting a downstream "failed to open".
export function resolveTrackId(
  tracks: Track[],
  input: string,
  assemblyName: string,
): string {
  const { resolved, looseMatches } = matchTrackId(tracks, input, assemblyName)
  if (resolved !== undefined) {
    return resolved
  }
  if (looseMatches.length > 1) {
    throw new Error(
      `--track "${input}" is ambiguous; matches: ${looseMatches.map(t => t.trackId).join(', ')}`,
    )
  }
  const colon = input.indexOf(':')
  const glued =
    colon > 0
      ? matchTrackId(tracks, input.slice(0, colon), assemblyName).resolved
      : undefined
  if (glued !== undefined) {
    throw new Error(
      `--track "${input}" not found in the config; modifiers follow the trackId as separate arguments: --track ${glued} ${input.slice(colon + 1)}`,
    )
  }
  const suggestions = tracks
    .filter(t => trackMatches(t, input.toLowerCase()))
    .slice(0, 8)
    .map(t => t.trackId)
  throw new Error(
    `--track "${input}" not found in the config${suggestions.length ? `. Did you mean: ${suggestions.join(', ')}?` : ''}`,
  )
}
