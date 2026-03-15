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
  /**
   * Multidimensional array of synteny track IDs, one inner array per level.
   * Level i connects views[i] and views[i+1].
   * Example for 3-way: [["grape_vs_peach"], ["peach_vs_cacao"]]
   * For 2-way, a flat string[] is also accepted for backwards compatibility.
   */
  tracks?: string[][] | string[]
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
