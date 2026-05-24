import type React from 'react'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { SnapshotIn } from '@jbrowse/mobx-state-tree'

export type Conf = SnapshotIn<AnyConfigurationModel>

export type ImportFormSyntenyTrack =
  | { type: 'preConfigured'; value: string }
  | { type: 'userOpened'; value: Conf }
  | { type: 'none' }

export interface LinearSyntenyViewInit {
  views: {
    loc?: string
    assembly: string
    tracks?: string[]
  }[]
  // synteny track ids per level: tracks[i] is shown between views[i] and
  // views[i+1]. string[] shorthand is treated as a single level-0 entry
  tracks?: string[] | string[][]
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
