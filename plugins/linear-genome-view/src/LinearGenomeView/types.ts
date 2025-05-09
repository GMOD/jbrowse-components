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

export interface InitState {
  loc: string
  assembly: string
  tracks?: string[]
}
