import type { RenderConfigContext } from './renderConfig.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature, LastStopTokenCheck, Region } from '@jbrowse/core/util'
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

// The rectangle allocated for a feature
export interface FeatureLayout {
  feature: Feature
  glyphType: GlyphType
  x: number
  y: number
  width: number
  height: number
  totalLayoutHeight: number
  totalLayoutWidth: number
  leftPadding: number
  children: FeatureLayout[]
}

// Arguments passed to glyph layout functions
export interface LayoutArgs {
  feature: Feature
  bpPerPx: number
  reversed: boolean
  configContext: RenderConfigContext
  pluginManager?: PluginManager
  parentFeature?: Feature
}

// Context passed to glyph draw functions
export interface DrawContext {
  region: Region
  bpPerPx: number
  configContext: RenderConfigContext
  theme: Theme
  canvasWidth: number
  peptideDataMap?: Map<string, PeptideData>
  colorByCDS?: boolean
}

// Polymorphic glyph interface
export interface Glyph {
  type: GlyphType
  match(feature: Feature, configContext: RenderConfigContext): boolean
  layout(args: LayoutArgs): FeatureLayout
  draw(
    ctx: CanvasRenderingContext2D,
    layout: FeatureLayout,
    drawContext: DrawContext,
  ): void
  // Optional: custom mouseover text for subfeatures
  getSubfeatureMouseover?(feature: Feature): string | undefined
  // Optional: indicates this glyph's children should be indexed for hit detection
  hasIndexableChildren?: boolean
}

export interface LayoutRecord {
  feature: Feature
  layout: FeatureLayout
  topPx: number
  label?: string
  description?: string
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
  featureId: string
  parentFeatureId: string
  displayLabel: string
  type: string
  leftPx: number
  topPx: number
  rightPx: number
  bottomPx: number
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
  stopTokenCheck?: LastStopTokenCheck
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
  | 'MatureProteinRegion'
  | 'RepeatRegion'
