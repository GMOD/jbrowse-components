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
// self pair needs the assembly named twice. A track declaring no
// assemblyNames matches nothing.
function comparesPair(track: Track, a: string, b: string) {
  const names = track.assemblyNames ?? []
  return a === b
    ? names.filter(name => name === a).length >= 2
    : names.includes(a) && names.includes(b)
}

// The comparisons between two assemblies, for the pairwise dotplot. Passing
// every SyntenyTrack in the config instead opened tracks belonging to another
// pair, which fetched their (often remote) alignment file only to refuse every
// block's assembly.
export function pairSyntenyTrackIds(data: Config, a: string, b: string) {
  return syntenyTracks(data)
    .filter(track => comparesPair(track, a, b))
    .map(track => track.trackId)
}

// The config's SyntenyTracks that compare some adjacent pair of the stack, as
// the view's flat `tracks`; the view puts each on every band it covers. A track
// no band can use is skipped with a warning: a config holding every pairwise
// alignment is the ordinary way to get one, and the view would report it as an
// error and fail the render.
export function stackSyntenyTrackIds(data: Config) {
  const order = data.assemblies.map(asm => asm.name)
  return syntenyTracks(data)
    .filter(track => {
      const placed = order
        .slice(1)
        .some((name, i) => comparesPair(track, order[i]!, name))
      if (!placed) {
        console.warn(
          `Warning: skipping synteny track "${track.trackId}" (${(track.assemblyNames ?? []).join(', ')}) — no pair of stacked assemblies is covered by it`,
        )
      }
      return placed
    })
    .map(track => track.trackId)
}
