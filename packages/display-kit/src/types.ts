import type { DisplayModel } from '@jbrowse/core/pluggableElementTypes/models'
import type { ViewExportSvgOptions } from '@jbrowse/core/svg/exportViewSvg'
import type { ThemeOptions } from '@mui/material'

/**
 * What an LGV track container may assume about the display it is rendering.
 * LGV track containers legitimately narrow `track.activeDisplay` to this — the
 * plugin union on `BaseTrackModel.displays` can't express it statically.
 *
 * Spelled out member by member rather than aliased to
 * `Instance<ReturnType<typeof TrackHeightMixin>>`. Aliasing the mixin made
 * everything ever added to it a hard requirement on every registered display,
 * including third-party ones that predate the addition and never composed the
 * mixin at all — which is how `setResizing` and `expandToContentHeight` became
 * two unguarded `is not a function` crashes on drag and double click
 * (GMOD/jbrowse-components#5626). Listing them here forces the required-or-
 * optional call at the moment a member joins the contract.
 *
 * `height` and `resizeHeight` are required: they are what a track resize handle
 * fundamentally needs, and every display has had them since 2020.
 */
export type LinearDisplayModel = DisplayModel & {
  height: number
  resizeHeight: (distance: number) => number
  /**
   * Grow the track to show the content it is hiding. Optional because only a
   * display that scrolls its own content can answer it; without it a double
   * click on the resize handle does nothing, which is the right answer for a
   * display that has nothing hidden.
   */
  expandToContentHeight?: () => void
  prefersOffset?: boolean
}

/**
 * Where a track's name is drawn. One vocabulary for the screen and the SVG
 * export: the config slot, the view's `trackLabels`, the export dialog and
 * `jbrowse-img --trackLabels` all name a mode from here, so a setting carried
 * from one to another needs no translation.
 *
 * The list is the enumeration the config slot validates against, so a mode
 * added here has to mean something on screen.
 */
export const VIEW_TRACK_LABEL_MODES = [
  'offset',
  'overlapping',
  'hidden',
] as const

export type ViewTrackLabelMode = (typeof VIEW_TRACK_LABEL_MODES)[number]

/**
 * The export can also reserve a gutter down the left of the figure and
 * right-align every name in it, which a view on screen has no room for.
 */
export type TrackLabelMode = ViewTrackLabelMode | 'left'

export interface ExportSvgOptions extends ViewExportSvgOptions {
  fontSize?: number
  rulerHeight?: number
  textHeight?: number
  trackLabels?: TrackLabelMode
  showGridlines?: boolean
}

export interface ExportSvgDisplayOptions extends ExportSvgOptions {
  theme?: ThemeOptions
  /**
   * The legend area the export container reserved to the right of every
   * track, the max of `svgLegendWidth()` across them. Absent or 0 — the
   * synteny and breakpoint exports reserve none — and a display floats its
   * legend over the plot instead; see {@link svgLegendAreaReserved}.
   */
  legendWidth?: number
  /**
   * The display's own canvas alone: no axis, legend, or anything the screen
   * draws over that canvas (labels, trees, arcs, chips). For an export that
   * resamples the strip the way the circular view's rings sample the on-screen
   * canvas, so the figure warps what the screen warps.
   */
  plotOnly?: boolean
}

export function svgLegendAreaReserved(opts?: ExportSvgDisplayOptions) {
  return (opts?.legendWidth ?? 0) > 0
}
