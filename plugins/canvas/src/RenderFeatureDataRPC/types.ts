import type { DisplayConfig } from './renderConfig.ts'
import type { IsoformStack } from './rpcTypes.ts'
import type { Feature } from '@jbrowse/core/util'
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'

export interface PeptideData {
  protein: string
  // protein-string indices whose residue came from a transl_except override
  translExceptIndices?: Set<number>
}

export interface FeatureLayout {
  feature: Feature
  glyphType: GlyphType
  // per-feature relative; the main thread's Y-row packing shifts it to its
  // final track-relative value
  y: number
  // Label rows are NOT in this — `labelRows` counts them and the main thread
  // spends them, being the only side that knows the label font size.
  height: number
  children: FeatureLayout[]
  // Rows stacked ABOVE this layout inside its parent, and on a container how
  // many it contains in total. A count rather than a height: everything else
  // the worker emits in Y survives the main thread's uniform compact scale,
  // while label text shrinks on a gentler multiplier than geometry does.
  labelRowsAbove?: number
  labelRows?: number
  ownsLabelRow?: boolean
  // Set by the worker's own `longestCoding` collapse; the fit ladder's
  // main-thread trim never sets it.
  isoformsCollapsed?: boolean
  // On a collapsed gene, the `canonicalTranscriptTags` entry that put the
  // surviving transcript first — absent when protein length decided it instead.
  canonicalTag?: string
  // set when this gene has >1 isoform, independent of the current glyph mode
  hasMultipleIsoforms?: boolean
  // Every child this gene drew, in drawn order. Only on a gene stacking more
  // than one child.
  isoformStack?: IsoformStack
}

// `bpPerPx` is deliberately absent: `collectRenderData` reads widths and X
// positions off the feature rather than baking them here.
export interface LayoutArgs {
  feature: Feature
  config: DisplayConfig
  parentFeature?: Feature
  // Worker jexl, needed only where `featureHeight` holds an expression, which
  // is why a test can call the layout functions without one.
  jexl?: JexlInstance
  // A per-GENE override of a track-wide setting, so it rides beside the config
  // rather than in it.
  expandedGeneIds?: ReadonlySet<string>
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
