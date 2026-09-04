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
function comparesPair(track: Track, a: string, b: string) {
  const names = track.assemblyNames ?? []
  return names.includes(a) && names.includes(b)
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

// Group synteny track ids by level. Level i sits between assembly i and i+1.
// Returns one entry per level (assemblies - 1).
//
// A track goes on EVERY level whose pair it can back, not just the first. One
// `AllVsAllPAFAdapter` or `MCScanBlocksAdapter` track listing N assemblies is
// meant to back every band of the stack — the level hands the adapter its own
// `assemblyNames` pair and the adapter serves that comparison, which is exactly
// what the multiway and all-vs-all synteny tutorials build. Matching only the
// first level left every band below the top one empty. `pairSyntenyTrackIds`
// already reads a multi-assembly track this way for the dotplot.
export function syntenyTrackLevels(data: Config) {
  const order = data.assemblies.map(asm => asm.name)
  const tracks = syntenyTracks(data)
  const levels = order
    .slice(1)
    .map((_, i) =>
      tracks
        .filter(track => comparesPair(track, order[i]!, order[i + 1]!))
        .map(track => track.trackId),
    )

  const placed = new Set(levels.flat())
  for (const track of tracks) {
    if (placed.has(track.trackId)) {
      continue
    } else if (!track.assemblyNames?.length) {
      // Nothing to place it by. The first gap is the only guess available, and
      // in the common two-assembly case it is the only gap there is.
      levels[0]?.push(track.trackId)
    } else {
      // It names assemblies, and no level's pair is among them: an A-vs-C
      // alignment in an A/B/C stack, or a self-synteny track in a view that
      // doesn't stack that assembly against itself. Level 0 would draw it
      // between the wrong two genomes, so skip it the way the dotplot skips
      // comparisons outside its two axes.
      console.warn(
        `Warning: skipping synteny track "${track.trackId}" (${track.assemblyNames.join(', ')}) — no pair of stacked assemblies is covered by it`,
      )
    }
  }
  return levels
}
