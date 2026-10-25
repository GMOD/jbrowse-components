import { isValidTag } from '@jbrowse/core/util'

import { fieldTag } from './facetLabels.ts'

import type {
  JunctionClass,
  JunctionSource,
} from '../features/sashimi/junctionClass.ts'
import type { FieldPredicate, Floor } from '@jbrowse/core/util/fieldPredicate'
import type { CategoryFilter } from '@jbrowse/display-kit/categoryFilter'
import type { CytosineContext } from '@jbrowse/modifications-utils'

export type { CategoryFilter }

export type { ArcColorField } from './arcColorOptions.ts'

/**
 * `pileup.bases.filter` as the modification extract reads it, each field at
 * its default where the list names none.
 */
export interface BasesFilter {
  // the floor a call's `probability` must clear in the by-type view
  probability: Floor
  // the cytosines the methylation fill and bisulfite read
  context: CytosineContext
  // the `code`s drawn, every one while unset or empty, so a type first seen
  // as more reads stream in shows up; the menu hides the layer in place of
  // an empty list
  codes?: readonly string[]
}

// The one reading of the `code` field, which the worker's extract, the legend
// and the type checkboxes all take, so what is ticked and what is drawn
// cannot disagree.
export function admitsCode(filter: BasesFilter, code: string) {
  const codes = filter.codes
  return !codes?.length || codes.includes(code)
}

// What a read body's fill classifies by, the buckets `fillCategory`
// (colorUtils.ts) switches on. Several color fields share one: baseQuality
// and base paint over the 'normal' body, modifications and bisulfite share
// 'modifications'. 'tag' is the per-read explicit color, a baked ABGR u32, so
// any field that resolves to one color per read on the CPU (tag values,
// mateRefName) rides it.
export type BodyFill =
  | 'normal'
  | 'strand'
  | 'mapq'
  | 'insertSize'
  | 'firstOfPairStrand'
  | 'pairOrientation'
  | 'insertSizeAndOrientation'
  | 'modifications'
  | 'tag'

/**
 * The read fields with a vocabulary or ramp of their own. A field that is also a facet dimension takes the facet's name, so
 * `facet` and `encoding.color` over it are one word; the insert-size fields are not
 * facet dimensions, since their band is sampled per region. There is no
 * `chainStrand`: a long read's inversion reads under Link mates and supplementary alignments.
 */
export const COLOR_FIELDS = [
  'strand',
  'mapq',
  'insertSize',
  'firstOfPairStrand',
  'pairOrientation',
  'insertSizeAndOrientation',
  'mateRefName',
] as const

/**
 * The per-base variables `pileup.bases` paints a cell per base from, which the
 * display draws as a layer of its own beside whatever fills the read.
 */
export const BASE_COLOR_FIELDS = [
  'baseQuality',
  'base',
  'modifications',
  'bisulfite',
] as const
export type BaseColorField = (typeof BASE_COLOR_FIELDS)[number]

// Every color field, named by the field it paints but for the plain fill
// and a tag or attribute. `COLOR_FIELD_DEFS` (shared/colorFieldDefs.ts) is typed
// `Record<ColorFieldKind, ColorFieldDef>`, so adding a field above is a
// compile error until it is classified there with both a shader path and a
// menu placement.
export type ColorFieldKind =
  | 'normal'
  | 'tag'
  | (typeof COLOR_FIELDS)[number]
  | BaseColorField

export type ReadColorFieldKind = Exclude<ColorFieldKind, BaseColorField>

/** How a read tag colors: a color per value, or a gradient over its numbers. */
export type TagColorScale = 'ordinal' | 'linear'

/**
 * The per-base layer `pileup.bases` draws. `unmodified` and `filter` are the
 * modifications and bisulfite fields' own.
 */
export type BaseLayer =
  | { field: 'baseQuality' }
  | { field: 'base' }
  | {
      field: 'modifications' | 'bisulfite'
      // `unmodified.show`: paint the unmodified side blue, at every cytosine
      // in context a read's 5mC group left implicit, and at each call more
      // likely unmodified
      unmodified: boolean
      filter: BasesFilter
    }

/** A modifications or bisulfite layer. */
export type ModificationLayer = Extract<BaseLayer, { unmodified: boolean }>

/** A write to `pileup.bases`, each member it names. */
export interface BasesPatch {
  show?: boolean
  // `encoding.color.field`
  field?: BaseColorField
  // `unmodified.show`
  unmodified?: boolean
  // `filter` entries by field, `undefined` returning one to its default
  filter?: Record<string, readonly FieldPredicate[] | undefined>
}

// The modifications 2-color view, where extractMethylation paints each
// cytosine's most likely state among 5mC, 5hmC and unmodified.
export function isMethylationView(
  layer: BaseLayer | undefined,
): layer is ModificationLayer & { field: 'modifications'; unmodified: true } {
  return layer?.field === 'modifications' && layer.unmodified
}

// The modes keying the methylated/unmethylated legend (5mC/5hmC named)
// rather than the per-type MM palette, as extractMethylation and
// extractBisulfite paint.
export function usesMethylationLegend(layer: BaseLayer | undefined) {
  return isMethylationView(layer) || layer?.field === 'bisulfite'
}

// The modes painting the explicit "not modified" (blue) state, gating that
// legend swatch, two-color over a non-cytosine mod included, which paints
// blue low-probability 6mA calls (extract.ts).
export function paintsUnmodifiedState(layer: BaseLayer | undefined) {
  return (
    (layer?.field === 'modifications' || layer?.field === 'bisulfite') &&
    layer.unmodified
  )
}

export interface TagFilter {
  tag: string
  value?: string
}

/** The junctions the display draws: its `junction` filter fields, read as `junctionFilter`. */
export interface JunctionFilter {
  minReads: number
  // A junction whose motif was never read off the reference is canonical here,
  // since only a known motif is evidence against it.
  nonCanonical?: CategoryFilter
  // The `junction.class` values drawn, every one when unset
  classes?: readonly JunctionClass[]
}

/** A junction filter write: `JunctionFilter`'s members, and `sources` writing `junction.source`. */
export interface JunctionFilterPatch extends Partial<JunctionFilter> {
  // every source when unset
  sources?: readonly JunctionSource[]
}

/** The connections the display draws: its `connection` and `breakpoint` filter fields, read as `connectionFilter`. */
export interface ConnectionFilter {
  interchrom?: CategoryFilter
  // a mate on the same chromosome outside the loaded window
  offscreenMates?: CategoryFilter
  // counted over one fragment length on both sides of the breakpoint
  // (`clusteredInterchromSupport`); a split read is exempt
  minInterchromReads: number
}

// `pairing` sections reads but filters none: it has several levels, and a
// filter over one would be the `{ field, oneOf }` shorthand GRAMMAR_OF_GRAPHICS
// declines.
export const READ_CATEGORY_KEYS = [
  'svSignal',
  'alone',
  'split',
  'spliced',
] as const

export type ReadCategoryKey = (typeof READ_CATEGORY_KEYS)[number]

// The read dimensions a facet names, each with its own partitioner
// (shared/groupFeatures.ts). Any other `field` is a tag (`tags.HP`) or a
// feature field. `alone` filters but sections nothing: each window judges it
// on its own, so a read can be alone in two windows and its section would move
// as regions load.
export const READ_DIMENSIONS = [
  'strand',
  'firstOfPairStrand',
  'pairOrientation',
  'pairing',
  'split',
  'spliced',
  'svSignal',
  'mapq',
  'mateRefName',
  'mateAssembly',
] as const
export type ReadDimension = (typeof READ_DIMENSIONS)[number]

// The read categories only a facet answers: reads keep the colors their arcs
// paint (ADR-230), so `encoding.color` names none of them.
export const FACET_ONLY_DIMENSIONS = [
  'pairing',
  'split',
  'spliced',
  'svSignal',
] as const satisfies readonly ReadDimension[]
export type FacetOnlyDimension = (typeof FACET_ONLY_DIMENSIONS)[number]

// In-track stacked grouping, the `facet` object as the model and worker carry
// it. `sort` is the section order: the keys it lists stack first, the rest
// follow sorted. Absent means a single ungrouped section.
export interface Facet {
  field: string
  sort?: readonly string[]
}

// What the worker partitions by. `unit` is the observation a section keeps
// whole: a read, or a chain (a read's mates and split segments, one QNAME).
// The domain stays behind, since ordering the sections is the main thread's.
export interface WorkerFacet {
  field: string
  unit?: 'read' | 'chain'
}

// Names in code order (index = code - 1). Single source for turning the numeric
// interbase code back into a name — used by the indicator hit-test and the
// coverage/indicator tooltip so the two can't drift.
const INTERBASE_TYPE_NAMES = ['insertion', 'softclip', 'hardclip'] as const

// The pileup's row orders over the whole window: by start, widest first,
// spliced reads first, split reads first, or the structural-variant evidence
// first: split reads, then 50 bp or larger indels, then discordant pairs
// (`svSignalTier`).
export const LAYOUT_ORDERS = [
  'position',
  'length',
  'spliced',
  'split',
  'svSignal',
] as const
export type LayoutOrder = (typeof LAYOUT_ORDERS)[number]

// The fields that rank the reads over one column, `pos` on `refName`: strand,
// the base there, mapping quality, pair orientation, the interbase mark there,
// or a SAM tag (`tags.HP`), spelt as `encoding.color` and `facet` spell a tag.
export const COLUMN_SORT_FIELDS = [
  'strand',
  'base',
  'mapq',
  'pairOrientation',
  ...INTERBASE_TYPE_NAMES,
] as const
export type ColumnSortField =
  | (typeof COLUMN_SORT_FIELDS)[number]
  | `tags.${string}`

// Every named value of the `sort` slot's `field`; a `tags.XX` field joins them.
export const SORT_FIELDS = [...LAYOUT_ORDERS, ...COLUMN_SORT_FIELDS] as const

export function isTagSortField(field: string): field is `tags.${string}` {
  const tag = fieldTag(field)
  return tag !== undefined && isValidTag(tag)
}

export function isColumnSortField(field: string): field is ColumnSortField {
  const named: readonly string[] = COLUMN_SORT_FIELDS
  return named.includes(field) || isTagSortField(field)
}

export interface SortColumn {
  field: ColumnSortField
  pos: number
  refName: string
  within?: number
}

// What `setSort` writes: a whole-window order, or a column sort.
export type SortSetting = LayoutOrder | SortColumn

export function isLayoutOrder(type: string): type is LayoutOrder {
  const orders: readonly string[] = LAYOUT_ORDERS
  return orders.includes(type)
}

// Bit flags stored in the Uint8Array `readChainHasSupp`, describing how a read's
// chain is split. Built by `attachChainFields` from every displayed region,
// reframed by `consensusChainStrandFrames`, and consumed by exactly ONE reader:
// `readColorCategory` (colorUtils), which bakes it into `readColorCategories`
// once per recolor. Every fill path — GPU, Canvas2D, SVG export, legend — then
// reads that baked category and never this.
//
// FLAGS, NOT A 0-4 ENUM: the byte answers two unrelated questions asked of
// different units — which way does this CHAIN point (a sign, from the chain's
// primary) and how did this MATE split away from its own primary (a category,
// from the pair) — and as consecutive integers the second could only be written
// by destroying the first.
export const CHAIN_SUPP_NONE = 0
// The chain carries a supplementary segment at all. Every other bit here is
// meaningless without it.
export const CHAIN_SUPP_PRESENT = 1 << 0
// The chain's frame is reverse. Absent means forward, which is also the answer
// for "no primary in this chain, so we cannot tell" — see `chainSuppFill`.
export const CHAIN_FRAME_REV = 1 << 1
// How this read's MATE split from its own primary. Both may be set while a
// chain's several supplementary segments disagree; `chainSplitKind` resolves the
// precedence in the one place that reads it, so the accumulation stays a plain
// OR.
export const CHAIN_SPLIT_INVERSION = 1 << 2
export const CHAIN_SPLIT_DELETION = 1 << 3
export const CHAIN_SPLIT_MASK = CHAIN_SPLIT_INVERSION | CHAIN_SPLIT_DELETION

export function chainHasSupp(bits: number) {
  return (bits & CHAIN_SUPP_PRESENT) !== 0
}

// The chain's frame as the sign it is: +1 keeps each segment's mapping strand,
// -1 inverts it. Reading the bit rather than comparing against a code is what
// makes an unexpected value fall to the unframed +1 — "we don't know" looking
// like "not flipped" — instead of to whichever branch the comparison happened to
// take.
export function chainFrame(bits: number) {
  return (bits & CHAIN_FRAME_REV) !== 0 ? -1 : 1
}

// Rewrite just the frame, leaving the split kind and the has-supp bit alone.
// Both main-thread passes over this array want exactly this and nothing else.
export function withChainFrame(bits: number, frame: number) {
  return frame === -1 ? bits | CHAIN_FRAME_REV : bits & ~CHAIN_FRAME_REV
}

// Inversion is the stronger signal and wins over a plain deletion, which wins
// over none. Returns the bit, so callers compare against CHAIN_SPLIT_* rather
// than against a third vocabulary.
export function chainSplitKind(bits: number) {
  return bits & CHAIN_SPLIT_INVERSION
    ? CHAIN_SPLIT_INVERSION
    : bits & CHAIN_SPLIT_DELETION
      ? CHAIN_SPLIT_DELETION
      : 0
}

// Numeric interbase type codes stored in Uint8Array interbaseTypes.
// Must match the order used in shared/buildInterbaseArrays addItems calls.
export const INTERBASE_INSERTION = 1
export const INTERBASE_SOFTCLIP = 2
export const INTERBASE_HARDCLIP = 3

export type InterbaseTypeName = (typeof INTERBASE_TYPE_NAMES)[number]

export function interbaseTypeName(code: number): InterbaseTypeName {
  return INTERBASE_TYPE_NAMES[code - 1] ?? 'insertion'
}

// insertion/softclip/hardclip are "interbase" (they sit between reference bases
// rather than over one). Used by the sort and context menus to decide sort type
// and keep the "Base pair" radio checked; narrows the arg on the true branch.
export function isInterbaseType(type: string): type is InterbaseTypeName {
  const names: readonly string[] = INTERBASE_TYPE_NAMES
  return names.includes(type)
}

// The one label vocabulary for CIGAR ops and interbase marks. Every surface that
// names one of them — hover tooltip, detail widget title, context menu item —
// reads it from here, so the same mark can't be spelled "Soft clip" in the
// tooltip and "Soft Clip" in the widget.
const CIGAR_TYPE_LABELS: Record<string, string> = {
  mismatch: 'SNP/Mismatch',
  insertion: 'Insertion',
  deletion: 'Deletion',
  skip: 'Skip (intron)',
  softclip: 'Soft clip',
  hardclip: 'Hard clip',
}

export function getCigarTypeLabel(type: string) {
  return CIGAR_TYPE_LABELS[type] ?? type
}
