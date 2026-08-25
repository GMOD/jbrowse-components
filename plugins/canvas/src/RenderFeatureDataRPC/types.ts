import type { DisplayConfig } from './renderConfig.ts'
import type { IsoformStack } from './rpcTypes.ts'
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
  // not bpPerPx-dependent. Label rows are NOT in it — they are counted in
  // `labelRows` below and spent on the main thread, which is the only side that
  // knows the display mode's label font size.
  height: number
  children: FeatureLayout[]
  // How many `below` subfeature-label rows are stacked ABOVE this layout inside
  // its parent, and (on a container) how many it contains in total.
  //
  // A count, not a height, because the worker is display-mode agnostic and the
  // row's height is the mode's resolved label font size — which only the main
  // thread knows. Everything else the worker emits in Y is proportional to
  // `heightPx` and so survives the main thread's uniform compact scale exactly;
  // a label row is the one thing that does not, because label text shrinks on
  // LABEL_FONT_MULTIPLIERS while geometry shrinks on the steeper
  // HEIGHT_MULTIPLIERS. So the worker counts the rows and the main thread spends
  // them (see applyHeightScale / bodyHeightPx).
  labelRowsAbove?: number
  labelRows?: number
  // this layout reserves a `below` label row of its own, under its body
  ownsLabelRow?: boolean
  // set when the worker's own `longestCoding` collapse dropped isoforms from a
  // multi-isoform gene (layoutSubfeatures). The fit ladder's trim happens on the
  // main thread and never sets this.
  isoformsCollapsed?: boolean
  // on a collapsed gene, the `canonicalTranscriptTags` entry that put the
  // surviving transcript first — absent when the annotation tagged none of them
  // and protein length decided it. Summarized per region into `isoformPicks`,
  // which is what the on-canvas chip names.
  canonicalTag?: string
  // set when this gene has >1 isoform, independent of the current glyph mode —
  // drives the always-visible gene-glyph control (which only makes sense when
  // there's actually a choice among isoforms to make)
  hasMultipleIsoforms?: boolean
  // Every child this gene drew, in drawn order, with what the main thread needs
  // to drop the losers: rank, gene-local geometry, and how many isoforms the
  // gene HAS. Only on a gene stacking more than one child; see `IsoformStack`.
  isoformStack?: IsoformStack
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
  // Genes the user opened from their own label badge, which draw every isoform
  // whatever the mode's collapse says. A per-GENE override of a track-wide
  // setting, so it rides beside the config rather than in it.
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
