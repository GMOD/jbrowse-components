import type {
  TrackInit,
  TrackLabelMode,
} from '@jbrowse/plugin-linear-genome-view'
import type { SyntenyViewSharedInit } from '@jbrowse/synteny-core'
import type React from 'react'

export type { ImportFormSyntenyTrack } from '@jbrowse/synteny-core'

// CIGAR display mode: 'full' colors indel wedges, 'matches' leaves indels
// see-through (transparent), 'off' draws blocks only.
export type CigarMode = 'off' | 'matches' | 'full'

// Sub-pixel width fade: 'auto' turns on once the view is dense enough to tangle.
export type FadeThinMode = 'auto' | 'on' | 'off'

export interface LinearSyntenyViewInit extends SyntenyViewSharedInit {
  views: {
    loc?: string
    assembly: string
    // a bare trackId string, or { trackId, ...displayOptions } to configure the
    // per-panel track (e.g. a compact LGVSyntenyDisplay height) — display props
    // sit inline, no displaySnapshot nesting needed
    tracks?: TrackInit[]
    // per-panel track-label placement (LGV `setTrackLabels`); 'offset' lifts the
    // label to its own row above the track instead of overlaying the features
    trackLabels?: 'overlapping' | 'offset' | 'hidden'
  }[]
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
  // Render ribbons as bezier curves rather than straight chords. Reads much
  // better at whole-genome scale where straight crossings stack into noise.
  drawCurves?: boolean
  cigarMode?: CigarMode
  // Per-feature opacity in [0,1]. The default (0.2) is tuned for dense
  // unfiltered hairballs; whole-genome views with minAlignmentLength set
  // can use a higher value (~0.4) for stronger color.
  alpha?: number
  // Fade sub-pixel-thin ribbons by their on-screen width. 'auto' (default)
  // fades only once the view is dense enough to tangle; a sparse whole-genome
  // comparison (e.g. distant species, every alignment sub-pixel) stays unfaded
  // so the fade doesn't wash it out. 'on'/'off' pin it.
  fadeThinAlignmentsMode?: FadeThinMode
  // Deprecated: legacy boolean form of fadeThinAlignmentsMode (true -> 'on',
  // false -> 'off'). Prefer fadeThinAlignmentsMode.
  fadeThinAlignments?: boolean
}

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
