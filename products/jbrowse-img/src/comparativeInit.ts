import {
  pairSyntenyTrackIds,
  stackSyntenyTrackIds,
  stackedRows,
} from './syntenyTracks.ts'

import type { Config } from './types.ts'
import type { DotplotViewInit } from '@jbrowse/plugin-dotplot-view'
import type { LinearSyntenyViewInit } from '@jbrowse/plugin-linear-comparative-view'

// Split out of renderRegion.ts because that module's pure-ESM deps cannot load
// under Jest's CJS transform.

export function comparativeViews(data: Config) {
  const rows = stackedRows(data)
  if (rows.length < 2) {
    throw new Error(
      'comparative mode requires at least two assemblies (repeat --fasta or --chromSizes)',
    )
  }
  return rows
}

export function dotplotInit(data: Config): DotplotViewInit {
  const [x, y] = comparativeViews(data)
  return {
    views: [x!, y!],
    tracks: pairSyntenyTrackIds(data, x!.assembly, y!.assembly),
  }
}

export function syntenyInit(data: Config): LinearSyntenyViewInit {
  return {
    views: comparativeViews(data),
    tracks: stackSyntenyTrackIds(data),
  }
}
