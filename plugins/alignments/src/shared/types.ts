import type { CytosineContext } from '@jbrowse/modifications-utils'

export type { ArcColorField } from './arcColorOptions.ts'

// Minimum modification-call probability (%) shown by default. Stored threshold
// is omitted at this value so default sessions don't carry a redundant field.
export const DEFAULT_MODIFICATION_THRESHOLD = 10

export const MODIFICATION_UNMODIFIED = ['hidden', 'calls', 'all'] as const

export type ModificationUnmodified = (typeof MODIFICATION_UNMODIFIED)[number]

export interface ModificationColorBy {
  // Which unmodified sites paint blue. `calls` paints the calls more likely
  // unmodified, under modifications and bisulfite alike. `all` also paints
  // every cytosine in the context, implicit ones included, merging 5mC/5hmC to
  // the most likely state and ignoring the threshold: the former standalone
  // 'methylation' scheme as a level of this one. Under bisulfite, which already
  // walks every cytosine, `all` paints as `calls` does.
  unmodified?: ModificationUnmodified
  // Allow-list of modification type codes to draw: ONLY these render, so a "6mA
  // only" view (shownModifications: ['a']) stays 6mA-only even if the basecaller
  // also emits 5mC/5hmC on the same reads. Empty or absent means every
  // detected type, the default, so a type first seen as more reads stream in
  // shows up; the menu turns the layer off in place of an empty list.
  shownModifications?: readonly string[]
  threshold?: number
  // cytosine context for `unmodified: 'all'`; absent means CpG. CHG/CHH
  // support plant methylation. Only consumed when filling (getMethBins) or in
  // bisulfite mode.
  cytosineContext?: CytosineContext
}

export function paintsUnmodifiedCalls(mods: ModificationColorBy | undefined) {
  return mods?.unmodified === 'calls' || mods?.unmodified === 'all'
}

// Single source for "is this modification type visible?" given a colorBy.
// Shared by the worker extract filter, the legend, and the color-by menu — the
// type checkboxes render straight off this predicate, so what is ticked and what
// is drawn cannot disagree.
export function isModificationTypeVisible(
  modifications: ModificationColorBy | undefined,
  type: string,
) {
  const shown = modifications?.shownModifications
  return !shown?.length || shown.includes(type)
}

// Shader color-scheme dispatch paths — the distinct branches read.slang
// actually implements. Several ColorSchemeTypes share one path: perBaseQuality/
// perBaseLetter paint over the 'normal' body, methylation/bisulfite reuse
// 'modifications' with different config.
// 'tag' is the generic per-read explicit-color path — the shader just unpacks a
// baked ABGR u32, so any scheme that resolves to one color per read on the CPU
// (tag values, mateRefName) rides it without a new shader branch.
// `COLOR_SCHEMES` (shared/colorSchemes.ts) maps each ColorSchemeType to one of
// these names; `ColorScheme` (display constants) is typed
// `Record<ShaderScheme, number>`, so the name list and the shader index map
// cannot drift.
export type ShaderScheme =
  | 'normal'
  | 'strand'
  | 'mappingQuality'
  | 'insertSize'
  | 'firstOfPairStrand'
  | 'pairOrientation'
  | 'insertSizeAndOrientation'
  | 'modifications'
  | 'tag'

// Every color-by scheme. `COLOR_SCHEMES` (shared/colorSchemes.ts) is typed
// `Record<ColorSchemeType, ColorSchemeDef>`, so adding a member here is a
// compile error until it is classified there with both a shader path and a menu
// placement. Typing this (vs a bare string) catches scheme-name typos at every
// construction site.
export type ColorSchemeType =
  | 'normal'
  | 'strand'
  | 'mappingQuality'
  | 'insertSize'
  | 'firstOfPairStrand'
  | 'pairOrientation'
  | 'insertSizeAndOrientation'
  | 'perBaseQuality'
  | 'perBaseLetter'
  | 'tag'
  | 'mateRefName'
  | 'modifications'
  | 'bisulfite'

// The schemes that paint a cell per base over the read, which the display
// draws as a layer of its own beside whatever fills the read.
export type BaseLayerType =
  | 'perBaseQuality'
  | 'perBaseLetter'
  | 'modifications'
  | 'bisulfite'

export type ReadColorSchemeType = Exclude<ColorSchemeType, BaseLayerType>

// A scheme by name with what it reads, for the code either half passes through.
export interface ColorBy {
  type: ColorSchemeType
  tag?: string
  // a feature attribute read through `feature.get`, where `tag` names a SAM tag
  attribute?: string
  modifications?: ModificationColorBy
}

/** What fills a read: the display's `color` object as a scheme. */
export interface ReadColorBy extends ColorBy {
  type: ReadColorSchemeType
  modifications?: undefined
}

/** How a read tag colors: a color per value, or a gradient over its numbers. */
export type TagColorScale = 'categorical' | 'linear'

/** The per-base layer: the display's `baseColor` object as a scheme. */
export interface BaseLayer extends ColorBy {
  type: BaseLayerType
  tag?: undefined
  attribute?: undefined
}

// True when modification coloring fills in unmarked canonical bases (the
// implicit-unmethylated cytosine walk): `unmodified: 'all'` under
// modifications. Reads only reach this through `colorByOf`, so the retired
// `methylation` name is never seen here.
export function isFillUnmarkedMode(colorBy: ColorBy | undefined) {
  return (
    colorBy?.type === 'modifications' &&
    colorBy.modifications?.unmodified === 'all'
  )
}

// True when the mode keys the methylated/unmethylated legend (5mC/5hmC named)
// rather than the per-type MM palette: the fill-unmarked cytosine walk and
// bisulfite (read C->T vs. reference) both do — see extractBisulfite / the
// fill-unmarked path.
export function usesMethylationLegend(colorBy: ColorBy | undefined) {
  return isFillUnmarkedMode(colorBy) || colorBy?.type === 'bisulfite'
}

// True when the mode actually paints the explicit "not modified" (blue) state,
// gating that legend swatch — including two-color over a non-cytosine mod,
// which paints blue low-probability 6mA calls (extract.ts).
export function paintsUnmodifiedState(colorBy: ColorBy | undefined) {
  return (
    (colorBy?.type === 'modifications' || colorBy?.type === 'bisulfite') &&
    paintsUnmodifiedCalls(colorBy.modifications)
  )
}

export interface TagFilter {
  tag: string
  value?: string
}

/**
 * A read-category filter: keep only the reads in the category, or drop them.
 * Absent means the category is not filtered on, which is why every one of these
 * fields is optional rather than carrying a third `'all'` member — the absent
 * filter and the inactive filter are the same state, and a stored `'all'` would
 * be a second spelling of it that `activeFilterCount` would have to know about.
 */
export type CategoryFilter = 'only' | 'exclude'

export interface ReadFilter {
  flagExclude: number
  flagInclude: number
  readName?: string
  // Multiple tag filters are AND-ed (a read must pass every one). Kept plural so
  // independent quick-filters like HP (haplotype) and RG (read group) coexist
  // instead of clobbering each other.
  tagFilters?: TagFilter[]
  // The four read categories, one vocabulary (see `CategoryFilter`) because to a
  // user they are one kind of question — which reads do I want. They apply at
  // two different points, though, and the split is not arbitrary: `spliced` is
  // decided per record as the adapter parses it, while the other three are
  // properties of a read's whole chain (its mate and supplementary segments
  // grouped by name) and so cannot be answered until the window is fetched.
  // See `filterSpliced` in the adapters vs `filterChainFeatures` in the worker.
  //
  // Spliced means the CIGAR carries a reference skip (`N`).
  spliced?: CategoryFilter
  // Concordant: flagged properly paired (SAM flag 0x2) AND in normal FR
  // orientation. A discordant pair — RR/LL/RL, the inversion and duplication
  // signal — is not one even when the aligner set the flag.
  properPairs?: CategoryFilter
  // A read whose mate and supplementary segments are all absent from this
  // window, so it stands alone (samtools calls these "singletons").
  singletons?: CategoryFilter
  // Part of a chimeric/split alignment: the aligner emitted a supplementary
  // segment for the read (SAM flag 0x800), read off the SA tag rather than off
  // what this window happened to fetch.
  split?: CategoryFilter
}

export const READ_CATEGORY_KEYS = [
  'properPairs',
  'singletons',
  'split',
  'spliced',
] as const satisfies readonly (keyof ReadFilter)[]

export type ReadCategoryKey = (typeof READ_CATEGORY_KEYS)[number]

// The read dimensions a facet names, each with its own partitioner
// (shared/groupFeatures.ts). Any other `field` is a tag (`tags.HP`) or a
// feature field.
export const READ_DIMENSIONS = [
  'strand',
  'firstOfPairStrand',
  'pairOrientation',
  'splitRead',
  'mapq',
  'mateAssembly',
] as const
export type ReadDimension = (typeof READ_DIMENSIONS)[number]

// In-track stacked grouping, the `facet` object as the model and worker carry
// it. `domain` is the section order: the keys it lists stack first, the rest
// follow sorted. Absent means a single ungrouped section.
export interface Facet {
  field: string
  domain?: readonly string[]
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
// spliced reads first, or reads aligned in pieces or across a large deletion
// first.
export const LAYOUT_ORDERS = ['position', 'length', 'spliced', 'split'] as const
export type LayoutOrder = (typeof LAYOUT_ORDERS)[number]

// The orders that rank the reads over one column, `pos` on `refName`: by
// strand, by the base there, by a tag's value, or by the interbase mark there.
export const COLUMN_SORT_TYPES = [
  'strand',
  'basePair',
  'tag',
  ...INTERBASE_TYPE_NAMES,
] as const
export type ColumnSortType = (typeof COLUMN_SORT_TYPES)[number]

// Every value of the `sort` slot's `type`, one radio group in the menu.
export const SORT_TYPES = [...LAYOUT_ORDERS, ...COLUMN_SORT_TYPES] as const
export type SortType = (typeof SORT_TYPES)[number]

export interface SortColumn {
  type: ColumnSortType
  pos: number
  refName: string
  tag?: string
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
