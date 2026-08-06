import type { DisplayConfig } from './renderConfig.ts'
import type { SerializableThemeArgs } from '@jbrowse/core/ui'
import type { StatusCallback } from '@jbrowse/core/util'
import type { SimpleFeatureSerialized } from '@jbrowse/core/util/simpleFeature'
import type { StopToken } from '@jbrowse/core/util/stopToken'

export interface LabelItem {
  text: string
  relativeY: number
  color: string
  textWidth: number
}

export interface RenderFeatureDataArgs {
  sessionId: string
  adapterConfig: Record<string, unknown>
  displayConfig: DisplayConfig
  // start/end MUST be integer bp positions. The on-screen producer is LGV's
  // `bufferedVisibleRegions` which already rounds (floor on start, ceil on
  // end). Callers that synthesize regions (e.g. tests) must round themselves
  // rather than relying on a worker-side defensive re-round.
  region: {
    refName: string
    start: number
    end: number
    assemblyName: string
    // sequence-adapter (FASTA) refName, set by the data-adapter renaming pass;
    // used to fetch reference sequence for peptide translation
    originalRefName?: string
  }
  bpPerPx: number
  // recolor CDS segments by reading frame. Purely a color choice — the codon
  // shading and amino acid letters are showAminoAcids' doing, so a track can
  // have either, both, or neither.
  colorByCDS?: boolean
  // translate coding features and emit the per-codon rects + amino acid overlay
  // (subject to the bpPerPx thresholds in zoomThresholds). The sequence fetch
  // this implies is the reason it's a separate flag from colorByCDS.
  showAminoAcids?: boolean
  // NCBI genetic-code id for this region, resolved from the assembly's
  // geneticCodes config (e.g. a mitochondrial contig = 2). Used as the
  // translation-table fallback for transcripts whose features lack a
  // transl_table attribute (e.g. UCSC genePred-derived GFFs).
  geneticCodeId?: number
  sequenceAdapter?: Record<string, unknown>
  showOnlyGenes?: boolean
  // "Show only these features" solo set: when present and non-empty, admit only
  // features whose id() is in the set. Matched against feature.id() (the
  // uniqueId) — not a jexl filter, since the uniqueId isn't reachable through
  // jexlFeatureProxy (feature.id reads the data field, e.g. GFF3 ID=, not the
  // uniqueId).
  soloFeatureIds?: string[]
  // "Hide this feature" exclusion set: features whose id() is in this set are
  // dropped from layout/drawing. Inverse of soloFeatureIds; hidden wins when a
  // feature is somehow in both.
  hiddenFeatureIds?: string[]
  maxFeatureDensity?: number
  // Compressed-byte budget for this region. When set and the adapter offers a
  // cheap index estimate (getRegionByteSize), the fetch short-circuits before
  // downloading features if the estimate exceeds it. Undefined disables the
  // byte gate (i.e. after force-load).
  byteLimit?: number
  theme?: SerializableThemeArgs
  stopToken?: StopToken
  statusCallback?: StatusCallback
}

export interface GetFeatureDetailsArgs {
  sessionId: string
  adapterConfig: Record<string, unknown>
  featureId: string
  region: {
    refName: string
    start: number
    end: number
    assemblyName: string
  }
}

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    RenderFeatureData: {
      args: RenderFeatureDataArgs
      return: RenderFeatureDataResult
    }
    GetCanvasFeatureDetails: {
      args: GetFeatureDetailsArgs
      return: { feature?: SimpleFeatureSerialized }
    }
  }
}

export interface FeatureDataResult {
  // Feature rectangles (box, CDS, UTR, exons)
  rectPositions: Uint32Array
  rectYs: Float32Array
  rectHeights: Float32Array
  // RGBA packed as a single u32 per rect (R=byte0 … A=byte3). Packed straight
  // into the instance buffer by the rect shader's packInstances — the shader
  // unpacks with bit shifts.
  rectColors: Uint32Array
  rectStrands: Float32Array // strand direction per rect: -1, 0, or +1
  // Allocated zero-filled by the worker, VALUED by the main-thread layout.
  // `applyLayoutToRegion` writes every element from its own per-feature decision:
  // 1 only for a feature whose sub-pixel box collapsed onto row 0 in the
  // dense-pileup regime (thousands of such marks), 0 otherwise, so a sparse
  // handful of variants stays opaque and only a genuine pileup fades to convey
  // density. Fade *eligibility* lives on `FlatbushItem.densityFade` (per feature);
  // there is deliberately no worker-side rect-level flag to disagree with it.
  rectDensityFade: Uint32Array

  // Connecting lines (introns) with strand info for dynamic chevron generation
  linePositions: Uint32Array
  lineYs: Float32Array
  // Box height each line rides on, so the renderer snaps the line onto the
  // box's drawn center row rather than ~1px off in odd-height modes.
  lineHeights: Float32Array
  lineColors: Uint32Array
  lineDirections: Int8Array // strand direction: -1, 0, or 1

  // Strand arrows (at feature ends)
  arrowXs: Uint32Array
  arrowYs: Float32Array
  // Box height each arrow sits on, so the renderer snaps it onto the box's
  // drawn center row rather than ~1px off in odd-height modes.
  arrowHeights: Float32Array
  // Length in bp of the feature each arrow marks. The arrow is drawn outside the
  // box, so on a narrow feature it covers more ground than the feature itself and
  // lands on the neighbor; both renderers drop it below
  // ARROW_MIN_FEATURE_WIDTH_PX on screen. Carried as bp because the worker never
  // sees bpPerPx — same division of labor as rectDensityFade, where the pixel
  // decision is made downstream.
  arrowWidthsBp: Uint32Array
  arrowDirections: Int8Array
  arrowColors: Uint32Array

  // Hit detection
  flatbushItems: FlatbushItem[]
  subfeatureInfos: SubfeatureInfo[]

  // Maps each rect/line/arrow element → flatbushItem index (for main-thread layout)
  rectFeatureIndices: Uint32Array
  lineFeatureIndices: Uint32Array
  arrowFeatureIndices: Uint32Array

  // Floating labels metadata
  floatingLabelsData: FloatingLabelsDataMap

  // Precomputed amino acid overlay items (only when colorByCDS is true)
  aminoAcidOverlay?: AminoAcidOverlayItem[]

  // Number of top-level features in this region (used for density calculations)
  featureCount: number

  // True when at least one gene in this region had >1 isoform and
  // geneGlyphMode === 'longestCoding' collapsed it down to one transcript —
  // drives the dismissible "Isoforms collapsed" notice. Undefined in fixtures
  // that predate this field; treat the same as false.
  isoformsCollapsed?: boolean

  // True when at least one gene in this region has >1 isoform, independent of
  // the current geneGlyphMode — drives the always-visible gene-glyph control.
  // Undefined in fixtures that predate this field; treat the same as false.
  hasMultiIsoformGenes?: boolean

  // Index-estimated compressed bytes for this region (when the adapter offers a
  // cheap estimate), so the display's byte gate reflects what was actually
  // fetched. Undefined for adapters with no index estimate.
  bytes?: number

  // Packed RGBA outline color for all rects (0 = no outline)
  outlineColor: number
}

export type RegionRenderData = Pick<
  FeatureDataResult,
  | 'rectPositions'
  | 'rectYs'
  | 'rectHeights'
  | 'rectColors'
  | 'rectStrands'
  | 'rectDensityFade'
  | 'outlineColor'
  | 'linePositions'
  | 'lineYs'
  | 'lineHeights'
  | 'lineColors'
  | 'lineDirections'
  | 'arrowXs'
  | 'arrowYs'
  | 'arrowHeights'
  | 'arrowWidthsBp'
  | 'arrowDirections'
  | 'arrowColors'
>

export interface RegionTooLargeResult {
  regionTooLarge: true
  // Which gate tripped, plus everything measured on the way there — NOT one or
  // the other. The byte stage runs first, so a density rejection still carries
  // the index estimate it cleared (`tooManyFeaturesResult` takes it as an
  // argument for exactly this reason), and `commitGateMeasurements` records both
  // axes off one result. A byte short-circuit returns before any features are
  // counted, so that one carries `bytes` alone.
  //
  // `bytes` is absent when the adapter offers no index estimate, or when the
  // fetch carried no `byteLimit` and so measured nothing.
  featureCount?: number
  bytes?: number
}

export type RenderFeatureDataResult = FeatureDataResult | RegionTooLargeResult

export interface AminoAcidOverlayItem {
  startBp: number
  endBp: number
  aminoAcid: string
  proteinIndex: number
  topPx: number
  heightPx: number
  isStopOrNonTriplet: boolean
  // residue translated via a transl_except override (Sec/Pyl/polyA stop)
  isTranslExcept: boolean
  flatbushIdx: number
}

// A transcript's geometry in the form the hover needs to name a genomic position
// the way a clinical report would — "exon 5/12", "c.1234+5". Raw spans only; the
// c./n. arithmetic is main-thread (hgvsPosition.ts).
export interface TranscriptCoords {
  // exons in TRANSCRIPTION order, flattened [start,end,…] — on the - strand the
  // highest-coordinate exon comes first, so it is exon 1
  exons: number[]
  strand: number
  // genomic [start, end) of the coding extent; absent for a non-coding
  // transcript, which is numbered `n.` from its first transcribed base
  coding?: [number, number]
}

export interface HitItemBase {
  featureId: string
  type: string | undefined
  startBp: number
  endBp: number
  topPx: number
  bottomPx: number
  // Present only on transcript-shaped glyphs. Rides on the shared base so a
  // nested transcript carries it on its SubfeatureInfo and a standalone one on
  // its FlatbushItem, and the hover reads whichever resolved.
  transcript?: TranscriptCoords
}

export interface FlatbushItem extends HitItemBase {
  kind: 'feature'
  featureHeightPx: number
  tooltip: string
  name?: string
  strand?: number
  // Whole-feature box glyph (variants, plain BED); packRef collapses sub-pixel
  // ones onto one row and the shader fades them into a density texture.
  densityFade: boolean
}

export interface SubfeatureInfo extends HitItemBase {
  kind: 'subfeature'
  parentFeatureId: string
  displayLabel?: string
}

export interface FeatureLabelData {
  featureId: string
  minX: number
  maxX: number
  topY: number
  featureHeight: number
  nameLabel?: LabelItem
  descriptionLabel?: LabelItem
  parentFeatureId?: string
  subfeatureLabel?: LabelItem & { isOverlay: boolean }
}

// Returns the max rendered width of any label that will actually display for
// this feature. Mirrors the visibility logic in overlayElements: name is
// gated on showLabels, description is gated on showDescriptions only (not
// showLabels), and subfeature labels always render when present. Each textWidth
// is the true measured width of the (already-truncated) label text, so the
// reservation computed here always matches what is drawn.
export function maxLabelTextWidth(
  labelData: FeatureLabelData,
  showLabels = true,
  showDescriptions = true,
) {
  const nameWidth = showLabels ? (labelData.nameLabel?.textWidth ?? 0) : 0
  const descWidth = showDescriptions
    ? (labelData.descriptionLabel?.textWidth ?? 0)
    : 0
  const subfeatureWidth = labelData.subfeatureLabel?.textWidth ?? 0
  return Math.max(nameWidth, descWidth, subfeatureWidth)
}

export type FloatingLabelsDataMap = Record<string, FeatureLabelData>
