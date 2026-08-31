import type { IsoformPicks } from './isoformPicks.ts'
import type { DisplayConfig } from './renderConfig.ts'
import type { RegionTooLargeResult } from '@jbrowse/core/rpc/byteBudget'
import type { SimpleFeatureSerialized } from '@jbrowse/core/util/simpleFeature'

export interface LabelItem {
  text: string
  relativeY: number
  textWidth: number
}

export interface RenderFeatureDataArgs {
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
  // supplied by renameRegionsIfNeeded during serialization, never by a caller
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
  // Genes the user opened from the isoform badge on their own label: these draw
  // every isoform whatever `geneGlyphMode` / `maxIsoforms` would collapse them
  // to. Matched against feature.id(), like solo/hidden above.
  expandedGeneIds?: string[]
  maxFeatureDensity?: number
  // Compressed-byte budget for this region. When set and the adapter offers a
  // cheap index estimate (getRegionByteSize), the fetch short-circuits before
  // downloading features if the estimate exceeds it. Undefined disables the
  // byte gate (i.e. after force-load).
  byteLimit?: number
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
      // only the data half owns buffers to transfer, so only it is wrapped —
      // the other arm of the return crosses as itself
      transferables: FeatureDataResult
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
  // 1 only for a feature whose sub-pixel box collapsed onto row 0 and landed
  // under a pile `PILEUP_FADE_DEPTH` marks deep, 0 otherwise, so a mark with
  // room around it — or with no more than a neighbour or two over it — stays
  // opaque and only a genuine pileup fades to convey density. Fade *eligibility*
  // lives on `FlatbushItem.densityFade` (per feature); there is deliberately no
  // worker-side rect-level flag to disagree with it.
  rectDensityFade: Uint32Array
  // Theme class per rect, or LENGTH ZERO when every rect here carries a literal
  // color (see colorClasses.ts and packRenderArrays' colorClassArray). The
  // worker has no palette, so a CDS painted by reading frame ships its class
  // and a zero color; the main-thread encode writes the lane.
  rectColorClasses: Uint8Array
  // Per-primitive `below` subfeature-label row counts, or LENGTH ZERO when this
  // region has none (the ordinary case — `subfeatureLabels` defaults to `none`).
  // The main thread adds `count × labelFontPx` to each Y after the compact
  // scale, because a label row's height is the mode's label font size and the
  // worker is mode-agnostic; see FeatureLayout.labelRowsAbove for why the row
  // cannot simply be baked into the Y the worker emits.
  rectLabelRows: Uint8Array
  // Which of the ROOT feature's direct children each rect belongs to, or LENGTH
  // ZERO when this region stacks no gene (the same idiom as `rectLabelRows`).
  // `ROOT_CHILD_ORDINAL` marks the root feature's own primitives, which no trim
  // may drop. The main-thread isoform trim filters on it — see `IsoformStack`.
  rectChildOrdinals: Uint16Array

  // Connecting lines (introns) with strand info for dynamic chevron generation
  linePositions: Uint32Array
  lineYs: Float32Array
  // Box height each line rides on, so the renderer snaps the line onto the
  // box's drawn center row rather than ~1px off in odd-height modes.
  lineHeights: Float32Array
  lineColors: Uint32Array
  lineDirections: Int8Array // strand direction: -1, 0, or 1
  lineColorClasses: Uint8Array
  lineLabelRows: Uint8Array
  lineChildOrdinals: Uint16Array

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
  arrowColorClasses: Uint8Array
  arrowLabelRows: Uint8Array
  arrowChildOrdinals: Uint16Array

  // Hit detection
  flatbushItems: FlatbushItem[]
  subfeatureInfos: SubfeatureInfo[]

  // Maps each rect/line/arrow element → flatbushItem index (for main-thread layout)
  rectFeatureIndices: Uint32Array
  lineFeatureIndices: Uint32Array
  arrowFeatureIndices: Uint32Array

  // Floating labels metadata
  floatingLabelsData: FloatingLabelsDataMap

  // Which label kinds this region emitted at all, baked in the worker so the
  // label overlay can skip the whole per-feature walk when no flag it holds can
  // produce a label. Only ever an over-estimate on the main thread: layout
  // deletes entries and decimates names, so a region that says it has names may
  // end up drawing none — which costs a walk that emits nothing, never a
  // missing label. Undefined in fixtures that predate the field; a reader must
  // treat that as "may have any kind" rather than as false.
  labelKinds?: LabelKinds

  // Precomputed amino acid overlay items (only when colorByCDS is true)
  aminoAcidOverlay?: AminoAcidOverlayItem[]

  // Number of top-level features in this region (used for density calculations)
  featureCount: number

  // True when at least one gene in this region has >1 isoform, independent of
  // the current geneGlyphMode — drives the always-visible gene-glyph control.
  // Undefined in fixtures that predate this field; treat the same as false.
  //
  // There is no per-region "and the collapse actually fired" companion to this.
  // There was, and nothing on the main thread ever read it: the control is shown
  // whenever switching modes would change something (this flag), and whether it
  // draws the loud chip or the quiet icon is decided from the display's OWN
  // resolved `effectiveGeneGlyphMode` — which is where it has to come from, since
  // that mode is zoom-dependent and would otherwise lag a region behind.
  hasMultiIsoformGenes?: boolean

  // What picked the transcript each gene `longestCoding` collapsed here is
  // showing, counted per rule (see IsoformPicks). Empty when nothing was
  // collapsed. The fit ladder's own trim adds to this on the main thread, where
  // it happens (`addTrimmedIsoformPicks`). Undefined in fixtures that predate
  // this field.
  isoformPicks?: IsoformPicks

  // Index-estimated compressed bytes for this region (when the adapter offers a
  // cheap estimate), so the display's byte gate reflects what was actually
  // fetched. Undefined for adapters with no index estimate.
  bytes?: number

  // Packed RGBA outline color for all rects (0 = no outline)
  outlineColor: number
  // LITERAL when `outlineColor` above is the color; OUTLINE when the slot asked
  // for the theme-derived one, which only the main thread can name.
  outlineColorClass: number
}

/**
 * Every packed primitive array above, selected by the naming convention the
 * three primitives already follow — `rect*` / `line*` / `arrow*`, one array per
 * attribute. The convention IS the contract here: a new attribute joins
 * `PackedPrimitives` and `RegionRenderData` by being named for its primitive,
 * where the two hand-written name lists this replaces (twenty entries in this
 * file, twenty more in packRenderArrays) had to be edited in step, and a missed
 * one is a field the renderer's type simply doesn't have.
 */
type PrimitiveArrayKey = Extract<
  keyof FeatureDataResult,
  `rect${string}` | `line${string}` | `arrow${string}`
>

/** What `packRenderArrays` produces: every primitive array, indices included. */
export type PackedPrimitives = Pick<FeatureDataResult, PrimitiveArrayKey>

/**
 * What a renderer backend draws one region from. Three families of array are
 * excluded on purpose, all main-thread inputs rather than draw inputs: a
 * `*FeatureIndices` maps an element back to its hit-test entry, a `*LabelRows`
 * is spent into the element's Y before a draw ever sees it, and a
 * `*ColorClasses` is consumed by the encode that produces the color lane a
 * draw does read. Nothing in a draw call reads any of them — and the class
 * lanes in particular must not be reachable there, or a renderer could draw
 * from the unresolved zero the worker shipped.
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

// The refusal marker moved to core (`@jbrowse/core/rpc/byteBudget`) once the
// fan-out helpers needed to recognize it too: whether a region was refused
// decides whether `loadedRegions` may claim it, and that decision cannot live
// in a plugin the display foundation can't import. Re-exported here so the two
// canvas RPCs still name it from one place.
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
  // residue translated via a transl_except override (Sec/Pyl/polyA stop)
  isTranslExcept: boolean
  flatbushIdx: number
}

// A transcript's geometry in the form the hover needs to name a genomic position
// the way a clinical report would — "exon 5/12", "c.1234+5". Raw spans only; the
// c./n. arithmetic is main-thread (transcriptPosition.ts).
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
  // Total `below` label rows stacked inside this feature. The gene's own row has
  // to grow by them, and it happens in `bodyHeightPx` — the one derivation both
  // the fit probe and the committed pack read, so the two cannot disagree about
  // how tall a labeled gene is.
  labelRows?: number
  featureHeightPx: number
  tooltip: string
  name?: string
  strand?: number
  // Whole-feature box glyph (variants, plain BED); packRef collapses sub-pixel
  // ones onto one row and the shader fades them into a density texture.
  densityFade: boolean
  // Present on a gene stacking more than one child. What the fit ladder's
  // isoform rung trims against.
  isoformStack?: IsoformStack
}

// The ordinal of the root feature's own primitives — never an isoform slot, so
// a trim always keeps them. 0xFFFF because the ordinals ship as a Uint16Array;
// a gene with 65535 children clamps, and a gene with that many is unreadable
// long before it matters.
export const ROOT_CHILD_ORDINAL = 0xffff

// One child of a gene, in the order the worker drew it.
export interface IsoformStackChild {
  featureId: string
  // index among the root feature's direct children, i.e. the `*ChildOrdinals`
  // value its primitives carry
  ordinal: number
  // false for a decoration beside the isoforms (an NCBI source record, a
  // `biological_region`), which a trim always keeps
  isoform: boolean
  // position in the gene's ranking (curated tag, coding, protein length);
  // Infinity for a decoration. The trim keeps the best by RANK, which is not
  // the drawn order — the stack sorts by (canonical, coding) alone.
  rank: number
  // gene-local, in the worker's own units — before the main thread's compact
  // scale and before its label rows are spent
  yPx: number
  heightPx: number
  // `below` label rows this child spends, its own included
  labelRows: number
  startBp: number
  endBp: number
}

// What a gene's stack costs and what it is made of, so the fit ladder can price
// the gene at any isoform count without re-running the worker's layout. The gap
// after each child is `isoformGapPx` of `boxHeightPx` below.
export interface IsoformStack {
  // every isoform the gene HAS, whatever was emitted — a `longestCoding` gene
  // ships one child and counts them all here, so the badge reads the same way
  // from either source
  isoformCount: number
  // what put the head of the ranking first, for the chip
  canonicalTag?: string
  // How many isoforms the WORKER's own collapse leaves, when it leaves fewer
  // than the gene has — 1 under `longestCoding`, absent otherwise. A gene the
  // user expanded ships every isoform whatever the mode says, so this is the
  // only thing that says what it was expanded FROM, which is the count its
  // "show fewer" badge offers to go back to.
  collapsedIsoformCount?: number
  // The gene's own resolved box height, which the gap between two of its rows is
  // a fraction of (`isoformGapPx`). The box rather than the gap, because the gap
  // alone cannot answer what the main thread's minimum-gap floor asks — what
  // makes two rows touch is how tall the boxes either side of it DRAW, which the
  // renderer's snapping decides from this (`isoformGapFloor.ts`).
  boxHeightPx: number
  children: IsoformStackChild[]
}

export interface SubfeatureInfo extends HitItemBase {
  kind: 'subfeature'
  // label rows above this subfeature (shifts topPx) and whether it owns one
  // (extends bottomPx over the row its own label occupies)
  labelRowsAbove?: number
  ownsLabelRow?: boolean
  parentFeatureId: string
  displayLabel?: string
  // which of the root feature's direct children this belongs to; see
  // `rectChildOrdinals`
  childOrdinal?: number
}

export interface FeatureLabelData {
  featureId: string
  // label rows above this entry, shifting topY — see FlatbushItem.labelRows
  labelRowsAbove?: number
  // label rows this entry CONTAINS, extending featureHeight. The name label
  // hangs off `topY + featureHeight` (labelPositioning), so without the same
  // term the hit box gets it lands that many rows up, inside its own stack.
  labelRows?: number
  minX: number
  maxX: number
  topY: number
  featureHeight: number
  nameLabel?: LabelItem
  descriptionLabel?: LabelItem
  // The isoform badge, drawn immediately after the name on the same row: "+3
  // more" on a gene the fit ladder trimmed, "show fewer" on one the user opened
  // from this badge (`expanded`). Written by the main-thread trim, which is the
  // side that knows what was left out; present only where something was.
  //
  // A label of its own rather than text folded into `nameLabel`, because it is
  // a control: it needs its own color, its own hit target, and — for the packer
  // — its own width beside the name's, which `renderedLabelWidths` adds to the
  // name row (the two share one line, so one reservation covers both).
  moreIsoformsLabel?: MoreIsoformsLabel
  parentFeatureId?: string
  subfeatureLabel?: LabelItem & { isOverlay: boolean }
  // which of the root feature's direct children this label belongs to, so the
  // trim drops the label of an isoform it dropped; see `rectChildOrdinals`
  childOrdinal?: number
}

// The isoform badge. `hidden` and `expanded` are what its hover sentence is
// written from, and both are always there — the trim emits the badge only where
// it left an isoform out (see createMoreIsoformsLabel).
export type MoreIsoformsLabel = LabelItem & {
  hidden: number
  expanded: boolean
}

// A Map, not a Record. At high feature density this container is walked once per
// frame by the label overlay and rebuilt by every committed layout, and an object
// with thousands of dynamically-added string keys is a V8 dictionary — the walk
// measured 6x slower than the same walk over a Map at 60k features, and
// `applyLayoutToRegion`'s `delete` keeps it in dictionary mode. Structured-clone
// carries a Map across the worker boundary unchanged.
export type FloatingLabelsDataMap = Map<string, FeatureLabelData>

// Whether a region emitted each label kind. The subfeature flag is the one that
// earns this its own type: names and descriptions are gated by display flags the
// main thread already holds, but a subfeature label is worker-baked, so
// "subfeature labels are switched on" says nothing about whether any exist — and
// a track of SNPs or repeats has none, which is exactly the dense case where
// walking every feature to discover that costs the most.
export interface LabelKinds {
  name: boolean
  description: boolean
  subfeature: boolean
}
