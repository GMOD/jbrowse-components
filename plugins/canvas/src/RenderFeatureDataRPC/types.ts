import type { RenderConfigContext } from './renderConfig.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Feature } from '@jbrowse/core/util'

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

export interface LayoutArgs {
  feature: Feature
  bpPerPx: number
  reversed: boolean
  configContext: RenderConfigContext
  pluginManager?: PluginManager
  parentFeature?: Feature
}

export interface Glyph {
  type: GlyphType
  match(feature: Feature, configContext: RenderConfigContext): boolean
  layout(args: LayoutArgs): FeatureLayout
  getSubfeatureMouseover?(feature: Feature): string | undefined
  hasIndexableChildren?: boolean
}

export interface LayoutRecord {
  feature: Feature
  layout: FeatureLayout
  topPx: number
}

export type GlyphType =
  | 'Box'
  | 'ProcessedTranscript'
  | 'Segments'
  | 'Subfeatures'
  | 'CDS'
  | 'MatureProteinRegion'
  | 'RepeatRegion'
