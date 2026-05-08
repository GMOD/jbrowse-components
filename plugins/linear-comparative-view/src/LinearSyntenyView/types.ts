import type React from 'react'

export type { ImportFormSyntenyTrack } from '@jbrowse/synteny-core'

export interface LinearSyntenyViewInit {
  views: {
    loc?: string
    assembly: string
    tracks?: string[]
  }[]
  // synteny track ids per level: tracks[i] is shown between views[i] and
  // views[i+1]. 2-way view has one entry; 3-way has two; etc.
  tracks?: string[][]
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
  trackLabels?: string
  showGridlines?: boolean
}
