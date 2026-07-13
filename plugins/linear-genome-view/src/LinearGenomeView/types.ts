import type { HighlightType } from '@jbrowse/core/util/highlights'

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
  trackLabels?: TrackLabelMode
  themeName?: string
  fontFamily?: string
  showGridlines?: boolean
  createCanvas?: (width: number, height: number) => HTMLCanvasElement
}

// canonical definition lives in core so the shared HighlightsMixin and dotplot
// can reference it without depending on this plugin
export type { HighlightType }

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
      // rarely-needed escape hatches: `trackSnapshot` applies to the track
      // config node, `displaySnapshot` explicitly to the display node. Any
      // OTHER key on this object is treated as a display-snapshot prop, so the
      // common case sets display options inline with no nesting:
      // `{ trackId, showDescriptions: false }` rather than
      // `{ trackId, displaySnapshot: { showDescriptions: false } }`.
      trackSnapshot?: Record<string, unknown>
      displaySnapshot?: Record<string, unknown>
      [key: string]: unknown
    }

export interface InitState {
  loc?: string
  assembly: string
  // restrict a whole-genome view to these assembly refNames (whole
  // chromosomes), in the order given — e.g. the main chromosomes without the
  // unplaced/alt contigs. Names resolve through the assembly's aliases. Ignored
  // when `loc` is set (which navigates to a single region instead).
  displayedRegionNames?: string[]
  tracks?: TrackInit[]
  tracklist?: boolean
  nav?: boolean
  // a string entry is a locstring or a JSON-encoded HighlightType (the URL
  // wire-format); programmatic callers (createViewState/session JSON) can pass
  // a HighlightType object directly
  highlight?: (string | HighlightType)[]
  showCenterLine?: boolean
  // track-label placement mode, matching the view's setTrackLabels action (not
  // the ExportSvg TrackLabelMode enum)
  trackLabels?: 'overlapping' | 'offset' | 'hidden'
  // color CDS segments by reading frame and draw amino acid lettering on gene
  // tracks (matches the view's setColorByCDS action)
  colorByCDS?: boolean
}
