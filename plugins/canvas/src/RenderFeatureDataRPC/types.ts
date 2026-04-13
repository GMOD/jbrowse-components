import type { DisplayConfig } from './renderConfig.ts'
import type { Feature } from '@jbrowse/core/util'

export interface PeptideData {
  protein: string
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
  config: DisplayConfig
  parentFeature?: Feature
}

export type GlyphType =
  | 'Box'
  | 'ProcessedTranscript'
  | 'Segments'
  | 'Subfeatures'
  | 'MatureProteinRegion'
