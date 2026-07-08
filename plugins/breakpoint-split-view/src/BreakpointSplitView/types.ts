import type { Feature } from '@jbrowse/core/util'
import type { TrackLabelMode } from '@jbrowse/plugin-linear-genome-view'

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
  // a track id, or a declarative {trackId, displaySnapshot} so per-view display
  // settings (e.g. a shorter alignments height) can be specified
  tracks?: (
    string | { trackId: string; displaySnapshot?: Record<string, unknown> }
  )[]
}

export type LayoutRecord = [number, number, number, number]

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
