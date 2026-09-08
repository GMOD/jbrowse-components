import type { IsoformPicks } from './isoformPicks.ts'
import type { DisplayConfig } from './renderConfig.ts'
import type {
  GatedFetchArgs,
  RegionTooLargeResult,
} from '@jbrowse/core/rpc/byteBudget'
import type { SimpleFeatureSerialized } from '@jbrowse/core/util/simpleFeature'

export interface LabelItem {
  text: string
  relativeY: number
  textWidth: number
}

export interface RenderFeatureDataArgs extends GatedFetchArgs {
  adapterConfig: Record<string, unknown>
  displayConfig: DisplayConfig
  // A caller that synthesizes a region must round start/end to integer bp
  // itself; the worker does no defensive re-round.
  region: {
    refName: string
    start: number
    end: number
    assemblyName: string
    // sequence-adapter (FASTA) refName, set by the data-adapter renaming pass
    originalRefName?: string
  }
  bpPerPx: number
  colorByCDS?: boolean
  // Implies a sequence fetch, which is why it is separate from colorByCDS.
  showAminoAcids?: boolean
  // Translation-table fallback for transcripts whose features lack a
  // transl_table attribute.
  geneticCodeId?: number
  // renameRegionsIfNeeded supplies this during serialization, never a caller.
  sequenceAdapter?: Record<string, unknown>
  showOnlyGenes?: boolean
  // Matched against feature.id() (the uniqueId) rather than run as a jexl
  // filter, since jexlFeatureProxy cannot reach the uniqueId.
  soloFeatureIds?: string[]
  // Hidden wins when a feature is in both this and soloFeatureIds.
  hiddenFeatureIds?: string[]
  // These genes draw every isoform whatever geneGlyphMode / maxIsoforms would
  // collapse them to.
  expandedGeneIds?: string[]
  maxFeatureDensity?: number
}

export interface GetFeatureDetailsArgs {
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
      // Only the data half owns buffers to transfer, so only it is wrapped.
      transferables: FeatureDataResult
    }
    GetCanvasFeatureDetails: {
      args: GetFeatureDetailsArgs
      return: { feature?: SimpleFeatureSerialized }
    }
  }
}

export interface FeatureDataResult {
  rectPositions: Uint32Array
  rectYs: Float32Array
  rectHeights: Float32Array
  // RGBA packed as a single u32 per rect (R=byte0 … A=byte3), which the rect
  // shader unpacks with bit shifts.
  rectColors: Uint32Array
  rectStrands: Float32Array
  // The worker allocates this zero-filled; the main-thread layout values it.
  rectDensityFade: Uint32Array
  // LENGTH ZERO when every rect here carries a literal color. The worker has no
  // palette, so a CDS painted by reading frame ships its class and a zero color.
  rectColorClasses: Uint8Array
  // LENGTH ZERO when this region emits no `below` subfeature labels. The main
  // thread adds `count × labelFontPx` after the compact scale, because the row
  // height is the mode's label font size and the worker is mode-agnostic.
  rectLabelRows: Uint8Array
  // LENGTH ZERO when this region stacks no gene. `ROOT_CHILD_ORDINAL` marks the
  // root feature's own primitives, which no trim may drop.
  rectChildOrdinals: Uint16Array

  linePositions: Uint32Array
  lineYs: Float32Array
  // Box height each line rides on, so the renderer snaps the line onto the
  // box's drawn center row rather than ~1px off in odd-height modes.
  lineHeights: Float32Array
  lineColors: Uint32Array
  lineDirections: Int8Array
  lineColorClasses: Uint8Array
  lineLabelRows: Uint8Array
  lineChildOrdinals: Uint16Array

  arrowXs: Uint32Array
  arrowYs: Float32Array
  // Box height each arrow sits on, so the renderer snaps it onto the box's
  // drawn center row rather than ~1px off in odd-height modes.
  arrowHeights: Float32Array
  // Carried as bp because the worker never sees bpPerPx; both renderers drop
  // the arrow below ARROW_MIN_FEATURE_WIDTH_PX on screen.
  arrowWidthsBp: Uint32Array
  arrowDirections: Int8Array
  arrowColors: Uint32Array
  arrowColorClasses: Uint8Array
  arrowLabelRows: Uint8Array
  arrowChildOrdinals: Uint16Array

  flatbushItems: FlatbushItem[]
  subfeatureInfos: SubfeatureInfo[]

  rectFeatureIndices: Uint32Array
  lineFeatureIndices: Uint32Array
  arrowFeatureIndices: Uint32Array

  floatingLabelsData: FloatingLabelsDataMap

  // Only ever an over-estimate on the main thread, and undefined in fixtures
  // that predate the field — a reader must treat that as "may have any kind".
  labelKinds?: LabelKinds

  aminoAcidOverlay?: AminoAcidOverlayItem[]

  featureCount: number

  // True when at least one gene in this region has >1 isoform, independent of
  // the current geneGlyphMode. Undefined in fixtures that predate it; treat the
  // same as false.
  hasMultiIsoformGenes?: boolean

  // Empty when nothing was collapsed; undefined in fixtures that predate it.
  isoformPicks?: IsoformPicks

  // Index-estimated compressed bytes, undefined for adapters with no estimate.
  bytes?: number

  outlineColor: number
  // LITERAL when `outlineColor` is the color; OUTLINE when the slot asked for
  // the theme-derived one, which only the main thread can name.
  outlineColorClass: number
}

/**
 * Every packed primitive array above, selected by the `rect*` / `line*` /
 * `arrow*` naming convention the three primitives follow — a new attribute
 * joins `PackedPrimitives` and `RegionRenderData` by being named for its
 * primitive.
 */
type PrimitiveArrayKey = Extract<
  keyof FeatureDataResult,
  `rect${string}` | `line${string}` | `arrow${string}`
>

export type PackedPrimitives = Pick<FeatureDataResult, PrimitiveArrayKey>

/**
 * What a renderer backend draws one region from. The four excluded families are
 * main-thread inputs; the class lanes in particular must not be reachable here,
 * or a renderer could draw from the unresolved zero the worker shipped.
 */
export type RegionRenderData = Pick<
  FeatureDataResult,
  | Exclude<
      PrimitiveArrayKey,
      | `${string}FeatureIndices`
      | `${string}LabelRows`
      | `${string}ColorClasses`
      | `${string}ChildOrdinals`
    >
  | 'outlineColor'
>

export type { RegionTooLargeResult } from '@jbrowse/core/rpc/byteBudget'

export type RenderFeatureDataResult = FeatureDataResult | RegionTooLargeResult

export interface AminoAcidOverlayItem {
  labelRowsAbove?: number
  childOrdinal?: number
  startBp: number
  endBp: number
  aminoAcid: string
  proteinIndex: number
  topPx: number
  heightPx: number
  isStopOrNonTriplet: boolean
  isTranslExcept: boolean
  flatbushIdx: number
}

// Raw spans only; the c./n. arithmetic is main-thread (transcriptPosition.ts).
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
  // Rides on the shared base so a nested transcript carries it on its
  // SubfeatureInfo and a standalone one on its FlatbushItem.
  transcript?: TranscriptCoords
}

export interface FlatbushItem extends HitItemBase {
  kind: 'feature'
  // Total `below` label rows stacked inside this feature. The gene's own row
  // grows by them in `bodyHeightPx`, the one derivation both the fit probe and
  // the committed pack read.
  labelRows?: number
  featureHeightPx: number
  tooltip: string
  name?: string
  strand?: number
  densityFade: boolean
  // Set when the glyph painted an intron between this feature's OWN parts. A
  // gene leaves it unset: its gaps belong to the transcripts it stacks, which
  // register as subfeatures of their own. It is the only main-thread evidence
  // that a typeless feature splices — a BED12 with no thick region carries no
  // type, and its blocks register nothing.
  spliced?: boolean
  // Present on a gene stacking more than one child.
  isoformStack?: IsoformStack
}

// Never an isoform slot, so a trim always keeps the primitives carrying it.
// 0xFFFF because the ordinals ship as a Uint16Array.
export const ROOT_CHILD_ORDINAL = 0xffff

export interface IsoformStackChild {
  featureId: string
  ordinal: number
  // false for a decoration beside the isoforms (an NCBI source record, a
  // `biological_region`), which a trim always keeps
  isoform: boolean
  // Position in the gene's ranking (curated tag, coding, protein length), and
  // Infinity for a decoration. Not the drawn order — the stack sorts by
  // (canonical, coding) alone.
  rank: number
  // gene-local, before the main thread's compact scale and its label rows
  yPx: number
  heightPx: number
  labelRows: number
  startBp: number
  endBp: number
}

// What a gene's stack costs and what it is made of, so the fit ladder can price
// the gene at any isoform count without re-running the worker's layout.
export interface IsoformStack {
  // every isoform the gene HAS, whatever was emitted
  isoformCount: number
  canonicalTag?: string
  // How many isoforms the worker's own collapse leaves, when it leaves fewer
  // than the gene has. A gene the user expanded ships every isoform, so this is
  // the only record of the count its "show fewer" badge goes back to.
  collapsedIsoformCount?: number
  // The gene's own resolved box height. What makes two rows touch is how tall
  // the boxes either side of the gap DRAW, which the renderer snaps from this.
  boxHeightPx: number
  children: IsoformStackChild[]
}

export interface SubfeatureInfo extends HitItemBase {
  kind: 'subfeature'
  labelRowsAbove?: number
  ownsLabelRow?: boolean
  parentFeatureId: string
  displayLabel?: string
  childOrdinal?: number
}

export interface FeatureLabelData {
  featureId: string
  labelRowsAbove?: number
  // Label rows this entry CONTAINS. The name label hangs off `topY +
  // featureHeight`, so without the same term the hit box lands that many rows
  // up, inside its own stack.
  labelRows?: number
  minX: number
  maxX: number
  topY: number
  featureHeight: number
  nameLabel?: LabelItem
  descriptionLabel?: LabelItem
  // A label of its own rather than text folded into `nameLabel` because it is a
  // control: its own color, its own hit target, and its own width beside the
  // name's, which the packer adds to the name row they share.
  moreIsoformsLabel?: MoreIsoformsLabel
  parentFeatureId?: string
  subfeatureLabel?: LabelItem & { isOverlay: boolean }
  childOrdinal?: number
}

// `hidden` and `expanded` are always there — the trim emits the badge only
// where it left an isoform out.
export type MoreIsoformsLabel = LabelItem & {
  hidden: number
  expanded: boolean
}

// A Map, not a Record. The label overlay walks this once per frame and every
// committed layout rebuilds it; an object with thousands of dynamically-added
// string keys is a V8 dictionary, measured 6x slower to walk at 60k features.
export type FloatingLabelsDataMap = Map<string, FeatureLabelData>

// A subfeature label is worker-baked, so "subfeature labels are switched on"
// says nothing about whether any exist — and a track of SNPs or repeats has
// none, the dense case where walking every feature to find out costs the most.
export interface LabelKinds {
  name: boolean
  description: boolean
  subfeature: boolean
}
