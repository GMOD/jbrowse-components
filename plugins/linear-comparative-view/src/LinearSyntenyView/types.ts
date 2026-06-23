import type React from 'react'

import type {
  TrackInit,
  TrackLabelMode,
} from '@jbrowse/plugin-linear-genome-view'
import type { SyntenyViewSharedInit } from '@jbrowse/synteny-core'

export type { ImportFormSyntenyTrack } from '@jbrowse/synteny-core'

export interface LinearSyntenyViewInit extends SyntenyViewSharedInit {
  views: {
    loc?: string
    assembly: string
    // a bare trackId string, or { trackId, displaySnapshot, trackSnapshot } to
    // configure the per-panel track (e.g. a compact LGVSyntenyDisplay height)
    tracks?: TrackInit[]
  }[]
  // synteny track ids per level: tracks[i] is shown between views[i] and
  // views[i+1]. string[] shorthand is treated as a single level-0 entry
  tracks?: string[] | string[][]
  // Pixel height of each synteny strip, one entry per level. Useful for
  // whole-genome views where the default ~100px is too cramped for the
  // ribbon detail to be readable.
  levelHeights?: number[]
  // Render ribbons as bezier curves rather than straight chords. Reads much
  // better at whole-genome scale where straight crossings stack into noise.
  drawCurves?: boolean
  // Per-feature opacity in [0,1]. The default (0.2) is tuned for dense
  // unfiltered hairballs; whole-genome views with minAlignmentLength set
  // can use a higher value (~0.4) for stronger color.
  alpha?: number
  // Fade sub-pixel-thin ribbons by their on-screen width (default true).
  // Turn off for a genuinely sparse whole-genome comparison (e.g. distant
  // species) where every real alignment is sub-pixel and the fade would
  // wash the view out instead of decluttering it.
  fadeThinAlignments?: boolean
}

export interface ExportSvgOptions {
  rasterizeLayers?: boolean
  format?: 'svg' | 'png'
  scale?: number
  filename?: string
  Wrapper?: React.FC<{ children: React.ReactNode }>
  fontSize?: number
  rulerHeight?: number
  textHeight?: number
  paddingHeight?: number
  headerHeight?: number
  cytobandHeight?: number
  themeName?: string
  trackLabels?: TrackLabelMode
  showGridlines?: boolean
}
