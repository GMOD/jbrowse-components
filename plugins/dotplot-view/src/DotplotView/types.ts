import type { SyntenyViewSharedInit } from '@jbrowse/synteny-core'

export type Coord = [number, number] | undefined

export const LS_CURSOR_MODE = 'dotplot-cursorMode'

export type { ImportFormSyntenyTrack } from '@jbrowse/synteny-core'

export interface DotplotViewInit extends SyntenyViewSharedInit {
  views: {
    assembly: string
    // optional per-axis region to navigate to ("ctgA:5000-15000"); hview is
    // views[0], vview is views[1]. Omitted => whole-genome overview.
    loc?: string
    // optional per-axis subset of the assembly's regions, in the given order —
    // the axis shows only these instead of the whole assembly. `loc` navigates
    // WITHIN what an axis displays; this changes what it displays at all, which
    // is what a fragmented assembly needs (e.g. plotting one haplotype of a
    // haplotype-resolved assembly against the reference, instead of both
    // interleaved on one axis). Entries may be globs — `['*_hap1']` beats
    // hand-listing 16 scaffolds and survives the assembly being rebuilt. Same
    // field and same matching as LinearGenomeView's init.displayedRegionNames
    // (both go through selectNamedRegions). Applied before autoDiagonalize, so
    // the reorder runs over the restricted set.
    displayedRegionNames?: string[]
  }[]
  tracks?: string[]
  // loc-strings ("chr1:100-200") or JSON objects matching HighlightType,
  // mirroring LinearGenomeView's init.highlight
  highlight?: string[]
}
