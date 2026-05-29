import type { SyntenyViewSharedInit } from '@jbrowse/synteny-core'

export type Coord = [number, number] | undefined

export type { ImportFormSyntenyTrack } from '@jbrowse/synteny-core'

export interface DotplotViewInit extends SyntenyViewSharedInit {
  views: {
    assembly: string
    // optional per-axis region to navigate to ("ctgA:5000-15000"); hview is
    // views[0], vview is views[1]. Omitted => whole-genome overview.
    loc?: string
  }[]
  tracks?: string[]
  // loc-strings ("chr1:100-200") or JSON objects matching HighlightType,
  // mirroring LinearGenomeView's init.highlight
  highlight?: string[]
}
