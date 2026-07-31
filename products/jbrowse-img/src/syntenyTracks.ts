import type { Config, Track } from './types.ts'

// Which SyntenyTracks in a config belong to which pair of stacked assemblies.
// Both comparative modes need this: synteny places each track at the level
// between the two assemblies it compares, and dotplot (pairwise by definition)
// takes only the comparisons between its two axes.

function syntenyTracks(data: Config) {
  return data.tracks.filter(track => track.type === 'SyntenyTrack')
}

// Whether a SyntenyTrack compares this pair of assemblies. Order-free: a track's
// assemblyNames are [query, target] and which side is which follows the file
// format (a chain's query is the LOWER assembly), not the stacking order. A
// track declaring no assemblyNames can't be placed, so it matches nothing.
export function comparesPair(track: Track, a: string, b: string) {
  const names = track.assemblyNames ?? []
  return names.includes(a) && names.includes(b)
}

// The comparisons between two assemblies, for the pairwise dotplot. Passing
// every SyntenyTrack in the config instead opened tracks belonging to another
// pair, which fetched their (often remote) alignment file only to log
// "<axis assembly> not found in this adapter" for every block.
export function pairSyntenyTrackIds(data: Config, a: string, b: string) {
  return syntenyTracks(data)
    .filter(track => comparesPair(track, a, b))
    .map(track => track.trackId)
}

// Group synteny track ids by level. Level i sits between assembly i and i+1, so
// a track is placed at the level whose adjacent assembly pair it compares.
// Returns one entry per level (assemblies - 1); tracks matching no pair fall
// back to level 0.
export function syntenyTrackLevels(data: Config) {
  const order = data.assemblies.map(asm => asm.name)
  const levels: string[][] = order.slice(1).map(() => [])
  for (const track of syntenyTracks(data)) {
    const level = order.findIndex(
      (name, i) =>
        i < order.length - 1 && comparesPair(track, name, order[i + 1]!),
    )
    levels[level === -1 ? 0 : level]!.push(track.trackId)
  }
  return levels
}
