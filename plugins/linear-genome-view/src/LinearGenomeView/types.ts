import type { HighlightType } from '@jbrowse/core/util/highlights'

export interface BpOffset {
  refName?: string
  index: number
  offset: number
  start?: number
  end?: number
  coord?: number
  reversed?: boolean
  assemblyName?: string
  oob?: boolean
}
export type TrackLabelMode = 'offset' | 'overlay' | 'left' | 'none'

export interface ExportSvgOptions {
  rasterizeLayers?: boolean
  format?: 'svg' | 'png'
  filename?: string
  Wrapper?: React.FC<{ children: React.ReactNode }>
  fontSize?: number
  rulerHeight?: number
  textHeight?: number
  trackLabels?: TrackLabelMode
  themeName?: string
  fontFamily?: string
  showGridlines?: boolean
  createCanvas?: (width: number, height: number) => HTMLCanvasElement
}

// canonical definition lives in core so the shared HighlightsMixin and dotplot
// can reference it without depending on this plugin
export type { HighlightType }

export interface NavLocation {
  refName: string
  start?: number
  end?: number
  assemblyName?: string
}

export interface VolatileGuide {
  xPos: number
}

export type TrackInit =
  | string
  | {
      trackId: string
      // rarely-needed escape hatches: `trackSnapshot` applies to the track
      // config node, `displaySnapshot` explicitly to the display node. Any
      // OTHER key on this object is treated as a display-snapshot prop, so the
      // common case sets display options inline with no nesting:
      // `{ trackId, showDescriptions: false }` rather than
      // `{ trackId, displaySnapshot: { showDescriptions: false } }`.
      trackSnapshot?: Record<string, unknown>
      displaySnapshot?: Record<string, unknown>
      [key: string]: unknown
    }

// A declarative LGV `init` blob holds ONLY keys that need on-attach
// resolution/conversion and have no direct MST representation — `loc` (→
// offsetPx/bpPerPx once the assembly loads), tracks (→ showTrack), highlight (→
// coercion), etc. — and is discarded once applied. Plain persisted view props
// (showCenterLine, trackLabels, colorByCDS, showHighlightChips) are NOT init:
// LaunchView sets them directly on the view snapshot, where MST restores them
// natively and they round-trip on save. Add a resolution field here + a case in
// afterAttach's applyInit + an entry in its knownInitKeyMap; add a plain prop to
// LinearGenomeViewLaunchProps (LaunchView forwards it automatically).
export interface InitState {
  loc?: string
  assembly: string
  // restrict a whole-genome view to these assembly refNames (whole
  // chromosomes), in the order given — e.g. the main chromosomes without the
  // unplaced/alt contigs. Names resolve through the assembly's aliases. Ignored
  // when `loc` is set (which navigates to a single region instead).
  displayedRegionNames?: string[]
  tracks?: TrackInit[]
  tracklist?: boolean
  nav?: boolean
  // a string entry is a locstring or a JSON-encoded HighlightType (the URL
  // wire-format); programmatic callers (createViewState/session JSON) can pass
  // a HighlightType object directly
  highlight?: (string | HighlightType)[]
}

// Plain persisted view props a launch spec may set inline alongside init keys.
// Unlike InitState these need no resolution — LaunchView forwards them straight
// onto the view snapshot.
export interface LinearGenomeViewLaunchProps {
  showCenterLine?: boolean
  // track-label placement mode, matching the view's setTrackLabels action (not
  // the ExportSvg TrackLabelMode enum)
  trackLabels?: 'overlapping' | 'offset' | 'hidden'
  // color CDS segments by reading frame and draw amino acid lettering on gene
  // tracks (matches the view's setColorByCDS action)
  colorByCDS?: boolean
  // draw the interactive link-icon chip on each highlight band (chips are
  // otherwise off by default, leaving a bare colored band)
  showHighlightChips?: boolean
}

export interface ExportRCodeOptions {
  filename?: string
}

/**
 * One track's contribution to the exported R script. The generated code is pure
 * `rtracklayer` + base `ggplot2` (no bespoke package) so it can be edited with
 * ordinary ggplot2 knowledge. A display returns the R expression that builds its
 * ggplot panel (referencing `chrom`, `start`, `end` from the enclosing
 * `plot_region()` function), so the whole figure regenerates for any region.
 */
export interface RTrackFragment {
  trackId: string
  trackName: string
  // R packages the panel needs library()'d, e.g. ['rtracklayer', 'ggplot2']
  packages: string[]
  // names of inline helper definitions this panel uses (keys of the codegen
  // HELPERS table, e.g. 'read_bigwig', 'bp_axis'); emitted once, deduped
  helpers: string[]
  // top-level R statement(s) run once before plot_region(), e.g. the track's
  // file-path variable assignment
  setup: string
  // name of the R variable the panel is assigned to, e.g. 'p_coverage'
  plotVariable: string
  // multi-line R expression assigned to plotVariable inside plot_region(); may
  // reference `chrom`, `start`, `end` and the track's setup variable
  plotExpr: string
  // relative patchwork height for this panel (default 1)
  heightWeight?: number
}
