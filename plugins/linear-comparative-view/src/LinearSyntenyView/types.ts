import type { LinearSyntenyViewStateModel } from './model.ts'
import type { ViewInit } from '@jbrowse/core/util/applyInitSettings'
import type { HighlightType } from '@jbrowse/core/util/highlights'
import type { TrackInit } from '@jbrowse/core/util/tracks'
import type {
  LinearGenomeViewLaunchProps,
  TrackLabelMode,
} from '@jbrowse/plugin-linear-genome-view'
import type { SyntenyViewSharedInit } from '@jbrowse/synteny-core'
import type React from 'react'

export type { ImportFormSyntenyTrack } from '@jbrowse/synteny-core'
export type { CigarMode } from './cigarModes.ts'

// Sub-pixel width fade: 'auto' turns on once the view is dense enough to tangle.
export type FadeThinMode = 'auto' | 'on' | 'off'

/**
 * The init keys `LinearSyntenyView` writes code for — things to DO rather than
 * state to hold, plus the names that mean something here other than what the
 * model's property of the same name means. `LINEAR_SYNTENY_INIT_COMMANDS` is
 * the runtime twin of this list.
 *
 * A new display setting does not belong here. See `LinearSyntenyViewInit`.
 *
 * #launchKeys LinearSyntenyView — the URL parameters page renders this
 * interface, and the one it extends, as the view's launch-key table. The `//`
 * comment above each field is what that table shows, so a field added without
 * one fails the docs build rather than rendering a blank cell.
 */
export interface LinearSyntenyViewCommands extends SyntenyViewSharedInit {
  // a row is an LGV, so it takes the LGV's own launch props (trackLabels,
  // showAminoAcids, colorByCDS, …) alongside what to show
  views: ({
    loc?: string
    assembly: string
    // a bare trackId string, or { trackId, ...displayOptions } to configure the
    // per-panel track (e.g. a compact LGVSyntenyDisplay height) — display props
    // sit inline, no displaySnapshot nesting needed
    tracks?: TrackInit[]
    // Subset of the assembly this row shows, in the given order, instead of the
    // whole genome. Entries may be globs (`*_MATERNAL`); same field, same
    // matching (selectNamedRegions) as the LGV's own init and the dotplot's
    // per-axis one. `loc` navigates WITHIN what a row displays, this decides
    // what it displays at all — which is what a self-alignment needs, since one
    // haplotype per row is the only way two rows of ONE haplotype-resolved
    // assembly are a comparison rather than two copies of the same picture.
    displayedRegionNames?: string[]
    // Shaded spans on this row: a locstring, or a HighlightType object. Same
    // field and same coercion as the LGV's own init — re-listed here for the
    // same reason `loc` and `displayedRegionNames` are, since a row is built
    // from a snapshot and never runs the LGV's init autorun. Naming the same
    // span on two rows is how a synteny figure says "this object, seen twice".
    highlight?: (string | HighlightType)[]
  } & LinearGenomeViewLaunchProps)[]
  // synteny track ids per level: tracks[i] is shown between views[i] and
  // views[i+1]. string[] shorthand is treated as a single level-0 entry
  tracks?: string[] | string[][]
  // Pixel height of each synteny strip, one entry per level. Useful for
  // whole-genome views where the default ~100px is too cramped for the
  // ribbon detail to be readable.
  levelHeights?: number[]
  // Open any genome row this init gives no tracks collapsed to its ruler. The
  // "No tracks active / Open track selector" block costs ~90px per row, which on
  // a five-row launch is more of the viewport than the ribbons; a row is one
  // click from expanding again (MiniControls, or the view menu's "Genome views"
  // → "Expand all views"). Off by default so an authored session keeps its rows
  // as written — the launch dialog turns it on, and offers a checkbox to not.
  collapseEmptyRows?: boolean
  // Put every genome row on one bp/px, the coarsest row's, instead of fitting
  // each to the pane width. The largest genome then fills the frame and the
  // rest are drawn shorter in proportion, so a size difference between rows
  // (polyploidy, a genome duplication) is visible as length rather than hidden
  // by the per-row stretch — and orthologs between two rows line up at the same
  // scale on both. Applied last, after any autoDiagonalize pass.
  sameScale?: boolean
}

/**
 * What a `LinearSyntenyView` can be launched with — a session spec's flat args,
 * a config `defaultSession` view's `init` blob, a share link.
 *
 * The commands above, plus every declared property of the view (`drawCurves`,
 * `cigarMode`, `alpha`, `drawLocationMarkers`, `opacityByIdentity`, `lodMode`,
 * and whatever the model grows next), each in its own type. None of them is
 * listed anywhere: the type comes off the state model and the runtime asks the
 * model too, so declaring a property is the whole of making it authorable.
 */
export type LinearSyntenyViewInit = ViewInit<
  LinearSyntenyViewStateModel,
  LinearSyntenyViewCommands
>

export interface ExportSvgOptions {
  rasterizeLayers?: boolean
  format?: 'svg' | 'png'
  filename?: string
  Wrapper?: React.FC<{ children: React.ReactNode }>
  fontSize?: number
  rulerHeight?: number
  textHeight?: number
  themeName?: string
  fontFamily?: string
  trackLabels?: TrackLabelMode
  showGridlines?: boolean
  // headless canvas factory for `rasterizeLayers` (jbrowse-img passes
  // node-canvas); without it the raster path needs a DOM canvas
  createCanvas?: (width: number, height: number) => HTMLCanvasElement
}
