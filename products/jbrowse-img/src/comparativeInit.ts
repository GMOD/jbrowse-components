import {
  pairSyntenyTrackIds,
  stackSyntenyTrackIds,
  stackedRows,
} from './syntenyTracks.ts'

import type { Config } from './types.ts'
import type { DotplotViewInit } from '@jbrowse/plugin-dotplot-view'
import type { LinearSyntenyViewInit } from '@jbrowse/plugin-linear-comparative-view'

// The `init` snapshot a comparative view is opened with, built from CLI flags
// (the --spec path supplies its own, see spec.ts); `--view` settings go over
// either in renderRegion's addLaunchView. Split out of renderRegion.ts because
// that module imports the plugin renderToSvg chain, which pulls pure-ESM deps
// Jest's CJS transform can't load — this one is pure, so the snapshot shape is
// unit-testable.

// The stacked rows, the first --fasta/--chromSizes on top (a dotplot's x axis),
// each at its `loc:` or whole.
export function comparativeViews(data: Config) {
  const rows = stackedRows(data)
  if (rows.length < 2) {
    throw new Error(
      'comparative mode requires at least two assemblies (repeat --fasta or --chromSizes)',
    )
  }
  return rows
}

// Dotplot is pairwise (x vs y), so it takes only the first two rows even if a
// config supplies more — and only the comparisons between those two.
// init.tracks is a flat list of comparison ids.
export function dotplotInit(data: Config): DotplotViewInit {
  const [x, y] = comparativeViews(data)
  return {
    views: [x!, y!],
    tracks: pairSyntenyTrackIds(data, x!.assembly, y!.assembly),
  }
}

// Synteny stacks every row; the view puts each comparison track in every gap
// between two assemblies it compares.
export function syntenyInit(data: Config): LinearSyntenyViewInit {
  return {
    views: comparativeViews(data),
    tracks: stackSyntenyTrackIds(data),
  }
}
