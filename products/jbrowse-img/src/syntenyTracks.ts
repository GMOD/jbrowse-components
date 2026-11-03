import { canonicalAssemblyName } from './assemblyName.ts'

import type { Config, Track } from './types.ts'

function syntenyTracks(data: Config) {
  return data.tracks.filter(track => track.type === 'SyntenyTrack')
}

export function stackedRows(data: Config) {
  return (
    data.comparativeRows ?? data.assemblies.map(asm => ({ assembly: asm.name }))
  )
}

// Order-free, since which side is the query follows the file format, not the
// stacking order. A self pair needs the assembly named twice.
function comparesPair(data: Config, track: Track, a: string, b: string) {
  const names = (track.assemblyNames ?? []).map(name =>
    canonicalAssemblyName(data.assemblies, name),
  )
  return a === b
    ? names.filter(name => name === a).length >= 2
    : names.includes(a) && names.includes(b)
}

export function pairSyntenyTrackIds(data: Config, a: string, b: string) {
  return syntenyTracks(data)
    .filter(track => comparesPair(data, track, a, b))
    .map(track => track.trackId)
}

// The view fails the render on a track no band can use, so those are skipped
export function stackSyntenyTrackIds(data: Config) {
  const order = stackedRows(data).map(row => row.assembly)
  return syntenyTracks(data)
    .filter(track => {
      const placed = order
        .slice(1)
        .some((name, i) => comparesPair(data, track, order[i]!, name))
      if (!placed) {
        console.warn(
          `Warning: skipping synteny track "${track.trackId}" (${(track.assemblyNames ?? []).join(', ')}) — no pair of stacked assemblies is covered by it`,
        )
      }
      return placed
    })
    .map(track => track.trackId)
}
