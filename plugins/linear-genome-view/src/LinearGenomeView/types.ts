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
export type TrackLabelMode = 'offset' | 'overlay' | 'left' | 'none'

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
  createCanvas?: (width: number, height: number) => HTMLCanvasElement
}

export interface HighlightType {
  start: number
  end: number
  // optional because view.highlight is persisted via types.frozen and
  // session JSON authored by hand may legitimately omit the assemblyName
  assemblyName?: string
  refName: string
  // overrides the theme's highlight color; user-supplied color is used as-is
  // so explicit alpha is preserved
  color?: string
  // shown in the chip tooltip; otherwise a generic label is used
  label?: string
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
