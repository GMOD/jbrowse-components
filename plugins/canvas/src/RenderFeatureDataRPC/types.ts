import type { DisplayConfig } from './renderConfig.ts'
import type { Feature } from '@jbrowse/core/util'
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'

export interface PeptideData {
  protein: string
  // protein-string indices whose residue came from a transl_except override;
  // worker-internal (consumed by collectRenderData, never crosses the boundary)
  translExceptIndices?: Set<number>
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
  config: DisplayConfig
  parentFeature?: Feature
  // worker pluginManager's jexl instance, threaded so layout-pass label
  // measurement (applyLabelDimensions → readFeatureLabels) resolves the same
  // plugin-registered jexl functions the render pass uses, keeping label widths
  // consistent with what is drawn.
  jexl?: JexlInstance
}

export type GlyphType =
  | 'Box'
  | 'ProcessedTranscript'
  | 'Segments'
  | 'Subfeatures'
  | 'MatureProteinRegion'
