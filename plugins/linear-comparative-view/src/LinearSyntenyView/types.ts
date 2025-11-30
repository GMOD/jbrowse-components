import type React from 'react'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { SnapshotIn } from '@jbrowse/mobx-state-tree'

export type Conf = SnapshotIn<AnyConfigurationModel>

export type ImportFormSyntenyTrack =
  | { type: 'preConfigured'; value: string }
  | { type: 'userOpened'; value: Conf }
  | { type: 'none' }

export interface ExportSvgOptions {
  rasterizeLayers?: boolean
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
}
