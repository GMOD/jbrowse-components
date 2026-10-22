import { stackedViews } from '@jbrowse/launch-args'

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

// One row per assembly, the first --fasta/--chromSizes on top (a dotplot's x
// axis), each at its `loc:` or whole.
export function comparativeViews(data: Config) {
  const { assemblies, assemblyLocs = [] } = data
  if (assemblies.length < 2) {
    throw new Error(
      'comparative mode requires at least two assemblies (repeat --fasta or --chromSizes)',
    )
  }
  return stackedViews({ assemblies, locs: assemblyLocs })
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
