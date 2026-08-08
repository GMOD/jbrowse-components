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
  // set when geneGlyphMode === 'longestCoding' collapsed a multi-isoform gene
  // down to its single longest coding transcript (layoutSubfeatures)
  isoformsCollapsed?: boolean
  // set when this gene has >1 isoform, independent of the current glyph mode —
  // drives the always-visible gene-glyph control (which only makes sense when
  // there's actually a choice among isoforms to make)
  hasMultipleIsoforms?: boolean
}

// `bpPerPx` is intentionally NOT part of LayoutArgs — feature widths and
// X positions are looked up from `feature.get('start')` /
// `feature.get('end')` in `collectRenderData`, not pre-baked here.
export interface LayoutArgs {
  feature: Feature
  config: DisplayConfig
  parentFeature?: Feature
  // Worker jexl, for the one layout-time slot that is a per-feature callback:
  // `featureHeight` (see featureHeightPx). Optional so the layout functions stay
  // directly callable from a test with nothing but a feature and a config —
  // `featureHeightPx` only needs it when the slot actually holds an expression,
  // and a plain numeric slot (every default config) never reaches for it.
  jexl?: JexlInstance
}

export type GlyphType =
  | 'Box'
  | 'ProcessedTranscript'
  | 'Segments'
  | 'Subfeatures'
  | 'MatureProteinRegion'
  | 'RepeatRegion'
  | 'CrisprGuide'
  | 'Motif'
