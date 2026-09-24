import type { ReadChain, ReadEntry } from './readChains.ts'
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
  /** the track body's vertical scroll */
  scrollTop: number
  /** the view's horizontal scroll, to turn absolute bp px into screen px */
  offsetPx: number
  /**
   * the display links its own reads (view-as-pairs / link supplementary
   * alignments, or curved connectors on every pair), so it already connects
   * everything that stays inside this level and an intra-view overlay curve
   * would just double it up
   */
  linksReads: boolean
}

export interface LayoutMatch {
  feature: Feature
  layout: LayoutRecord
  level: number
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

// The discriminant Overlay.tsx dispatches on, from the track's type.
export type OverlayKind = 'alignment' | 'variant'

export type OverlayMatch =
  | { kind: 'variant'; layoutMatches: LayoutMatch[][] }
  | {
      kind: 'alignment'
      chains: ReadChain[]
      layouts: ReadonlyMap<ReadEntry, LayoutRecord>
    }

export { type TrackLabelMode } from '@jbrowse/plugin-linear-genome-view'
