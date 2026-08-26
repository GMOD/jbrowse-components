import type { DisplayModel } from '@jbrowse/core/pluggableElementTypes/models'
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

export interface ExportSvgDisplayOptions extends ExportSvgOptions {
  theme?: ThemeOptions
  legendWidth?: number
}
