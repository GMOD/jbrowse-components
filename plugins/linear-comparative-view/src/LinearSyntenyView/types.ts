import type React from 'react'

import type { SyntenyViewSharedInit } from '@jbrowse/synteny-core'

export type { ImportFormSyntenyTrack } from '@jbrowse/synteny-core'

export interface LinearSyntenyViewInit extends SyntenyViewSharedInit {
  views: {
    loc?: string
    assembly: string
    tracks?: string[]
  }[]
  // synteny track ids per level: tracks[i] is shown between views[i] and
  // views[i+1]. string[] shorthand is treated as a single level-0 entry
  tracks?: string[] | string[][]
  // Pixel height of each synteny strip, one entry per level. Useful for
  // whole-genome views where the default ~100px is too cramped for the
  // ribbon detail to be readable.
  levelHeights?: number[]
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
