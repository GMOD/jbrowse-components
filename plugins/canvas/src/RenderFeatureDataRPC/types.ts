import type { DisplayConfig } from './renderConfig.ts'
import type { Feature } from '@jbrowse/core/util'

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
  // set when geneGlyphMode === 'longestCoding' collapsed a multi-isoform gene
  // down to its single longest coding transcript (layoutSubfeatures)
  isoformsCollapsed?: boolean
}

// `bpPerPx` is intentionally NOT part of LayoutArgs — feature widths and
// X positions are looked up from `feature.get('start')` /
// `feature.get('end')` in `collectRenderData`, not pre-baked here.
export interface LayoutArgs {
  feature: Feature
  config: DisplayConfig
  parentFeature?: Feature
}

export type GlyphType =
  | 'Box'
  | 'ProcessedTranscript'
  | 'Segments'
  | 'Subfeatures'
  | 'MatureProteinRegion'
  | 'RepeatRegion'
