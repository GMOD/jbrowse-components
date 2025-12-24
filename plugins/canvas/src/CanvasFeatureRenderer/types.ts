import type { RenderConfigContext } from './renderConfig'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature, Region } from '@jbrowse/core/util'
import type { BaseLayout } from '@jbrowse/core/util/layouts'
import type { Theme } from '@mui/material'

export interface SequenceData {
  seq: string
  cds: { start: number; end: number }[]
}

export interface PeptideData {
  sequenceData: SequenceData
  protein?: string
}

export interface FeatureLayout {
  feature: Feature
  x: number
  y: number
  width: number
  height: number
  totalFeatureHeight: number
  totalLayoutHeight: number
  totalLayoutWidth: number
  leftPadding: number
  children: FeatureLayout[]
}

export interface LayoutRecord {
  feature: Feature
  layout: FeatureLayout
  topPx: number
  label: string
  description: string
}

export interface DrawFeatureArgs {
  ctx: CanvasRenderingContext2D
  feature: Feature
  featureLayout: FeatureLayout
  region: Region
  bpPerPx: number
  config: AnyConfigurationModel
  configContext: RenderConfigContext
  theme: Theme
  reversed: boolean
  topLevel: boolean
  canvasWidth: number
  peptideDataMap?: Map<string, PeptideData>
  colorByCDS?: boolean
  pluginManager?: PluginManager
}

export interface FlatbushItem {
  featureId: string
  type: string
  startBp: number
  endBp: number
  leftPx: number
  rightPx: number
  topPx: number
  bottomPx: number
  tooltip?: string
}

export interface SubfeatureInfo {
  displayLabel: string
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
  peptideDataMap?: Map<string, PeptideData>
  colorByCDS?: boolean
  pluginManager?: PluginManager
}

export type GlyphType =
  | 'Box'
  | 'ProcessedTranscript'
  | 'Segments'
  | 'Subfeatures'
  | 'CDS'
