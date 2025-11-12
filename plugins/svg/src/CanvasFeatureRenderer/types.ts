import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature, Region } from '@jbrowse/core/util'
import type { BaseLayout } from '@jbrowse/core/util/layouts'
import type { SceneGraph } from '@jbrowse/core/util/layouts'
import type { Theme } from '@mui/material'

export interface LayoutRecord {
  feature: Feature
  rootLayout: SceneGraph
  startPx: number
  topPx: number
}

export interface DrawFeatureArgs {
  ctx: CanvasRenderingContext2D
  feature: Feature
  featureLayout: SceneGraph
  region: Region
  bpPerPx: number
  config: AnyConfigurationModel
  theme: Theme
  reversed: boolean
  topLevel: boolean
  canvasWidth: number
}

export interface DrawingResult {
  coords: number[]
  items: FlatbushItem[]
}

export interface FlatbushItem {
  feature: Feature
  type: string
}

export interface RenderArgs {
  features: Map<string, Feature>
  layout: BaseLayout<unknown>
  regions: Region[]
  bpPerPx: number
  config: AnyConfigurationModel
  displayMode: string
  theme: Record<string, any>
  highResolutionScaling?: number
  stopToken?: string
}

export type GlyphType =
  | 'Box'
  | 'ProcessedTranscript'
  | 'Segments'
  | 'Subfeatures'
  | 'CDS'
