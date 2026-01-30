export interface BpOffset {
  refName?: string
  index: number
  offset: number
  start?: number
  end?: number
  coord?: number
  reversed?: boolean
  assemblyName?: string
  oob?: boolean
}
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
  trackLabels?: string
  themeName?: string
  showGridlines?: boolean
}

export interface HighlightType {
  start: number
  end: number
  assemblyName: string
  refName: string
}

export interface NavLocation {
  refName: string
  start?: number
  end?: number
  assemblyName?: string
}

export interface VolatileGuide {
  xPos: number
}

export type TrackInit =
  | string
  | {
      trackId: string
      displaySnapshot?: Record<string, unknown>
      trackSnapshot?: Record<string, unknown>
    }

export interface InitState {
  loc?: string
  assembly: string
  tracks?: TrackInit[]
  tracklist?: boolean
  nav?: boolean
  highlight?: string[]
}
