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
  paddingHeight?: number
  headerHeight?: number
  cytobandHeight?: number
  trackLabels?: TrackLabelMode
  themeName?: string
  showGridlines?: boolean
}

export interface BreakpointSplitViewInit {
  views: {
    loc?: string
    assembly: string
    tracks?: string[]
  }[]
}

export type LayoutRecord = [number, number, number, number]

export interface LayoutMatch {
  feature: Feature
  layout: LayoutRecord
  level: number
  clipLengthAtStartOfRead: number
}

export interface OverlayMatch {
  kind: 'alignment' | 'translocation' | 'paired' | 'breakend'
  allFeatures: Map<string, Feature>
  layoutMatches: LayoutMatch[][]
  hasPairedReads?: boolean
}

export { type TrackLabelMode } from '@jbrowse/plugin-linear-genome-view'
