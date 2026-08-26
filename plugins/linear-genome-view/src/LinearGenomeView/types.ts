import type { LinearGenomeViewStateModel } from './model.ts'
import type { HighlightType } from '@jbrowse/core/util/highlights'
import type { TrackInit } from '@jbrowse/core/util/tracks'
import type { SnapshotIn } from '@jbrowse/mobx-state-tree'

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
export type {
  ExportSvgOptions,
  TrackLabelMode,
} from '@jbrowse/display-kit/types'

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

// A declarative LGV `init` blob holds ONLY keys that need on-attach
// resolution/conversion and have no direct MST representation — `loc` (→
// offsetPx/bpPerPx once the assembly loads), tracks (→ showTrack), highlight (→
// coercion), etc. — and is discarded once applied. Plain persisted view props
// (showCenterLine, trackLabels, colorByCDS, showAminoAcids, showHighlightChips)
// are NOT init:
// LaunchView sets them directly on the view snapshot, where MST restores them
// natively and they round-trip on save. Add a resolution field here + a case in
// afterAttach's applyInit + an entry in its knownInitKeyMap; add a plain prop to
// LinearGenomeViewLaunchProps (LaunchView forwards it automatically).
// #region initState
export interface InitState {
  /**
   * A locstring, or several separated by spaces to open a discontinuous view:
   * `'chr3:25,325,000-25,361,000 chr10:58,716,500-58,718,500'`. Multiple
   * regions are the only declarative way to frame something spread across loci
   * (a derivative allele against its sources, a gene's partners in a fusion) --
   * `displayedRegionNames` takes whole chromosomes, not intervals.
   */
  loc?: string
  // fractional zoom-out applied around `loc` for context (passed to
  // navToLocString's `grow`), e.g. 0.2 pads a region by 20% on each side.
  // Ignored without `loc`.
  grow?: number
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
// onto the view snapshot, where MST restores and validates them natively.
//
// EVERY declared property of the view, derived, minus the init keys (which mean
// something else here: `tracks` is trackIds to open, not built track models)
// and the view's identity. Nothing is listed, so a property is settable from a
// spec — and type-checked — from the line that declares it.
//
// It used to be a hand-written eight, and the model has grown past it:
// `hideHeader`, `hideHeaderOverview`, `hideNoTracksActive`, `labelsVisible`,
// `scalebarOnly`, `showCytobands`, `showGridlines` and `showTrackOutlines` were
// all declared, all settable from the menu, and all dropped in silence by a
// spec that named them — which is most of what a figure or an embed wants to
// say. `partitionLaunchKeys` reads the same set off the model at runtime.
export type LinearGenomeViewLaunchProps = Partial<
  Omit<
    SnapshotIn<LinearGenomeViewStateModel>,
    keyof InitState | 'id' | 'type' | 'init'
  >
>
// #endregion

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
  // Bind this panel's data to `d_<plotVariable minus its p_ prefix>` before the
  // plot, instead of embedding the read inline in `plotExpr`. Two things need
  // it, and both are why it exists: a height that is a FUNCTION of what was read
  // (heightWeightExpr below, so a feature track that packs 61 rows gets a panel
  // 61 rows tall rather than the codegen's guess), and a reader who wants to
  // inspect the frame a panel drew. `plotExpr` then references the variable.
  dataExpr?: string
  // R expression for this panel's patchwork height, evaluated after `dataExpr`
  // and free to read it. Overrides heightWeight when present; the resulting
  // figure height is computed in R too (see assembleRScript's jb_height_in).
  heightWeightExpr?: string
  // whether this panel lives on the shared cumulative-bp x-axis (the default):
  // plot_regions() adds region_scale + inter-region dividers + the coord range to
  // it. Set false for a panel that manages its own x-axis and is not genomic-bp
  // indexed (e.g. the site-indexed multi-sample variant matrix), so the cumulative
  // decoration is not applied.
  cumulativeAxis?: boolean
  // Display settings this panel could NOT reproduce, phrased for a reader —
  // `Group by tag HP`, say. Named in the script's header rather than dropped in
  // silence, the same doctrine as translateFeatureFilters' NOT TRANSLATED note
  // and the skipped-track list: a figure that quietly differs from the browser
  // view it claims to twin is the failure mode worth spending a comment on.
  unreproduced?: string[]
  // JBrowse refname aliases for this track's file: canonical refName -> the
  // name the file actually uses (chr1 vs 1 vs NC_000001.11), only entries that
  // differ. Attached by the view (not the per-display builder) from the
  // assembly's per-adapter refName map, so the emitted script translates the
  // canonical `chrom` before reading each file. Empty/undefined = no aliasing.
  refNameMap?: Record<string, string>
}
