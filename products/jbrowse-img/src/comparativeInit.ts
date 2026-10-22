import { pairSyntenyTrackIds, stackSyntenyTrackIds } from './syntenyTracks.ts'

import type { Config } from './types.ts'
import type { DotplotViewInit } from '@jbrowse/plugin-dotplot-view'
import type { LinearSyntenyViewInit } from '@jbrowse/plugin-linear-comparative-view'

// The `init` snapshot a comparative view is opened with, built from CLI flags
// (the --spec path supplies its own, see spec.ts); `--view` settings go over
// either in renderRegion's addLaunchView. Split out of renderRegion.ts because
// that module imports the plugin renderToSvg chain, which pulls pure-ESM deps
// Jest's CJS transform can't load — this one is pure, so the snapshot shape is
// unit-testable.

// One sub-view per assembly in [query, target, …] order: the first
// --fasta/--chromSizes is the query (top in synteny, x-axis in dotplot).
// Comparative views render adjacent assembly pairs as stacked levels, so this
// supports an arbitrary number of assemblies (a-vs-b is the common case). Each
// assembly's optional location comes from data.assemblyLocs (its `loc:`
// modifier); the rest show their whole genome.
export function comparativeViews(data: Config) {
  const { assemblies, assemblyLocs = [] } = data
  if (assemblies.length < 2) {
    throw new Error(
      'comparative mode requires at least two assemblies (repeat --fasta or --chromSizes)',
    )
  }
  return assemblies.map((asm, i) =>
    assemblyLocs[i]
      ? { assembly: asm.name, loc: assemblyLocs[i] }
      : { assembly: asm.name },
  )
}

// Dotplot is pairwise (x vs y), so it takes only the first two assemblies even
// if a config supplies more — and only the comparisons between those two.
// init.tracks is a flat list of comparison ids.
export function dotplotInit(data: Config): DotplotViewInit {
  const [x, y] = data.assemblies
  return {
    views: comparativeViews(data).slice(0, 2),
    tracks: x && y ? pairSyntenyTrackIds(data, x.name, y.name) : [],
  }
}

// Synteny stacks every assembly; the view puts each comparison track in every
// gap between two assemblies it compares.
export function syntenyInit(data: Config): LinearSyntenyViewInit {
  return {
    views: comparativeViews(data),
    tracks: stackSyntenyTrackIds(data),
  }
}
