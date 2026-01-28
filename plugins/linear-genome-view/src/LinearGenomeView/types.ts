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

// R Script Export Types

export interface ExportRCodeOptions {
  // Output options
  filename?: string

  // Package preferences
  useJbrowseR?: boolean // Use jbrowseR package for data loading (recommended)
  useBioconductor?: boolean // Use Bioconductor packages directly

  // Visualization options
  plotLibrary?: 'ggplot2' | 'base' | 'plotly'
  includeTheme?: boolean

  // Data options
  embedData?: boolean // Embed data inline vs. fetch from URLs
  maxEmbedRows?: number // Max rows to embed (default: 1000)
}

export interface RCodeFragment {
  // Metadata
  trackId: string
  trackName: string
  displayType: string

  // Package dependencies
  packages: string[]

  // Code sections
  dataCode: string // Code to load/prepare data
  plotCode: string // Code to create visualization

  // Variable names used
  dataVariable: string
  plotVariable: string

  // Optional: additional setup code (e.g., for special adapters)
  setupCode?: string

  // Optional embedded data (if embedData: true)
  embeddedData?: {
    format: 'csv' | 'json'
    content: string
  }
}
