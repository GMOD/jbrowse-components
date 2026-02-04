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
  renderToStaticMarkup?: (node: React.ReactElement) => string
}

export interface BreakpointSplitViewInit {
  views: {
    loc?: string
    assembly: string
    tracks?: string[]
  }[]
}

export interface Breakend {
  MateDirection: string
  Join: string
  Replacement: string
  MatePosition: string
}

export type LayoutRecord = [number, number, number, number]
