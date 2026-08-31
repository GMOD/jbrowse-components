import type { Feature } from '@jbrowse/core/util'
import type { TrackInit } from '@jbrowse/core/util/tracks'
import type { ExportSvgOptions as LgvExportSvgOptions } from '@jbrowse/plugin-linear-genome-view'

// The LGV export's options plus the one this view adds, rather than a parallel
// copy: everything here is forwarded verbatim to each sub-view's display
// `renderSvg`, so an option added there (createCanvas, for the headless raster
// path) has to be spellable here too.
export interface ExportSvgOptions extends LgvExportSvgOptions {
  // Band reserved above each stacked view's ruler: the assembly label floats in
  // it, and it separates the view from the one above.
  headerHeight?: number
}

export interface BreakpointSplitViewInitView {
  loc?: string
  assembly: string
  // a track id, or a declarative { trackId, ...displayOptions } so per-view
  // display settings (e.g. a shorter alignments height) can be specified inline
  tracks?: TrackInit[]
}

/**
 * The launch keys `BreakpointSplitView` writes code for, which is one: the
 * panels to stack. `views` collides with the built rows the model declares, so
 * the partition splits it per entry — a row carrying `type` is a built
 * LinearGenomeView snapshot MST restores, one without it is a recipe this
 * view's own autorun opens.
 *
 * A plain display setting does not belong here: `showIntraviewLinks`,
 * `linkViews`, `interactiveOverlay` and `showHeader` are declared on the model,
 * and the partition leaves them on the snapshot.
 *
 * #launchKeys BreakpointSplitView — the URL parameters page renders this
 * interface as the view's launch-key table.
 */
export interface BreakpointSplitViewCommands {
  // one entry per stacked panel, each naming its own assembly, an optional loc
  // and the tracks to open there
  views?: BreakpointSplitViewInitView[]
}

export type LayoutRecord = [number, number, number, number]

// Per-view-level geometry an overlay needs to place a feature, resolved once per
// render by getTrackOverlayData. One entry per entry in `views`, same order.
export interface OverlayLevel {
  /** top of this level's track body, relative to the overlay SVG */
  yOffset: number
  /** rendered height of the track body */
  height: number
  /** height of the coverage subtrack sitting above the pileup */
  coverageOffset: number
  /** the track body's vertical scroll; zeroed for SVG export */
  scrollTop: number
  /** the view's horizontal scroll, to turn absolute bp px into screen px */
  offsetPx: number
  /**
   * the display links its own reads (view-as-pairs / link supplementary
   * alignments), so it already connects everything that stays inside this
   * level and an intra-view overlay curve would just double it up
   */
  linksReads: boolean
}

export interface LayoutMatch {
  feature: Feature
  layout: LayoutRecord
  level: number
  clipLengthAtStartOfRead: number
  // For split-read chains (clip-sorted): loc strings of any alignment segments
  // the read has between this entry and the previous one that aren't present in
  // any loaded view, so the connector to it spans hidden segments. Undefined
  // when the two are truly consecutive.
  hiddenSegmentsBefore?: string[]
}

/**
 * The one overlay curve the pointer is on. Held by the VIEW, not by each
 * overlay: the overlay is one SVG spanning every row, so only one of its curves
 * can be under the pointer at a time, and a copy per track let two of them draw
 * a hover at once.
 */
export interface OverlayHover {
  trackId: string
  /** the PathSpec id — a feature id, or a junction's pair of them */
  id: string
}

// The discriminant Overlay.tsx dispatches on. 'alignment' comes from an
// AlignmentsTrack, the rest from a VariantTrack (see classifyVariantFeatures).
export type OverlayKind = 'alignment' | 'translocation' | 'paired' | 'breakend'

export interface OverlayMatch {
  kind: OverlayKind
  allFeatures: Map<string, Feature>
  layoutMatches: LayoutMatch[][]
  hasPairedReads?: boolean
}

// One alignment of a split read, on the read's 5' axis (see readChainSegments).
export interface ChainSegment {
  clip: number
  refName: string
  start: number
  end: number
}

// A track's features paired into chunks, plus each split-read chunk's SA-derived
// chain — everything overlayMatches needs that depends on features alone and not
// on any track's layout.
export interface MatchedChunks {
  kind: OverlayKind
  allFeatures: Map<string, Feature>
  matched: Feature[][]
  hasPairedReads?: boolean
  chains?: ChainSegment[][]
}

export { type TrackLabelMode } from '@jbrowse/plugin-linear-genome-view'
