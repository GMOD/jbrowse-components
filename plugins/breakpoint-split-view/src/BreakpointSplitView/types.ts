import type { Feature } from '@jbrowse/core/util'
import type {
  TrackInit,
  TrackLabelMode,
} from '@jbrowse/plugin-linear-genome-view'

export interface ExportSvgOptions {
  rasterizeLayers?: boolean
  format?: 'svg' | 'png'
  filename?: string
  Wrapper?: React.FC<{ children: React.ReactNode }>
  fontSize?: number
  rulerHeight?: number
  textHeight?: number
  headerHeight?: number
  trackLabels?: TrackLabelMode
  themeName?: string
  fontFamily?: string
  showGridlines?: boolean
}

export interface BreakpointSplitViewInitView {
  loc?: string
  assembly: string
  // a track id, or a declarative { trackId, ...displayOptions } so per-view
  // display settings (e.g. a shorter alignments height) can be specified inline
  tracks?: TrackInit[]
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

export interface OverlayMatch {
  kind: 'alignment' | 'translocation' | 'paired' | 'breakend'
  allFeatures: Map<string, Feature>
  layoutMatches: LayoutMatch[][]
  hasPairedReads?: boolean
}

export { type TrackLabelMode } from '@jbrowse/plugin-linear-genome-view'
