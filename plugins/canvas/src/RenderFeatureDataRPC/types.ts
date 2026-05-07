import type { DisplayConfig } from './renderConfig.ts'
import type { Feature } from '@jbrowse/core/util'

export interface PeptideData {
  protein: string
}

export interface FeatureLayout {
  feature: Feature
  glyphType: GlyphType
  // Y is per-feature relative; main-thread Y-row packing
  // (`computeLaidOutData`) shifts it to its final track-relative value.
  y: number
  // height is config-driven (`config.featureHeight * heightMultiplier`),
  // not bpPerPx-dependent.
  height: number
  // height + label space (label visibility depends on config, not bpPerPx).
  totalLayoutHeight: number
  children: FeatureLayout[]
}

// `bpPerPx` is intentionally NOT part of LayoutArgs — feature widths and
// X positions are looked up from `feature.get('start')` /
// `feature.get('end')` in `collectRenderData`, not pre-baked here.
export interface LayoutArgs {
  feature: Feature
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
