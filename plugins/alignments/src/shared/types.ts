import { defaultFilterFlags } from './util.ts'

import type { CytosineContext } from '@jbrowse/modifications-utils'

export type { ArcColorByType } from './arcColorOptions.ts'

// Minimum modification-call probability (%) shown by default. Stored threshold
// is omitted at this value so default sessions don't carry a redundant field.
export const DEFAULT_MODIFICATION_THRESHOLD = 10

export interface ModificationColorBy {
  // Paint the not-modified side blue instead of leaving it blank. One meaning,
  // one default (off), in every mode that reads it — modifications and
  // bisulfite alike. Bisulfite used to default this ON and spell the check as
  // `twoColor !== false`, so the same field name meant opposite things with
  // opposite defaults in the two modes.
  twoColor?: boolean
  // Legacy deny-list of modification type codes, read-only: no UI has ever
  // written it, and the type checkboxes now clear it the first time one is
  // toggled (any deny-list is expressible as the allow-list below). Kept so a
  // hand-written config keeps resolving; don't add new writers.
  hiddenModifications?: string[]
  // Allow-list of modification type codes to draw, and the only filter the UI
  // writes. Present wins over hiddenModifications: ONLY these render, so a "6mA
  // only" view (shownModifications: ['a']) stays 6mA-only even if the basecaller
  // also emits 5mC/5hmC on the same reads. Absent means every detected type —
  // the default, so a type first seen as more reads stream in shows up. The
  // empty list is a real state (nothing drawn), not a synonym for absent.
  shownModifications?: string[]
  threshold?: number
  // cytosine context for the fill-unmarked view; absent means CpG. CHG/CHH
  // support plant methylation. Only consumed when filling (getMethBins) or in
  // bisulfite mode.
  cytosineContext?: CytosineContext
  // Paint every cytosine in the chosen context — including implicitly
  // unmodified ones — as methylated/unmethylated, merging 5mC/5hmC to the
  // most-likely state and ignoring the probability threshold. This is the former
  // standalone 'methylation' scheme expressed as a sub-mode of modifications, so
  // a user only has to think about "color by modifications". General-ready: the
  // fill currently covers cytosine mods (getMethBins) only.
  fillUnmarked?: boolean
}

// Single source for "is this modification type visible?" given a colorBy.
// shownModifications (allow-list) wins whenever it is present at all; otherwise
// hiddenModifications (deny-list) is subtracted from the all-visible default.
// Shared by the worker extract filter, the legend, and the color-by menu — the
// type checkboxes render straight off this predicate, so what is ticked and what
// is drawn cannot disagree.
//
// Absent means "every detected type", so a type first seen as more reads stream
// in defaults to visible. An explicit list means exactly those, INCLUDING the
// empty list, which draws no marks — that lets the menu offer a plain checkbox
// per type with no special "you must keep one ticked" rule.
export function isModificationTypeVisible(
  modifications: ModificationColorBy | undefined,
  type: string,
) {
  const shown = modifications?.shownModifications
  return shown === undefined
    ? !(modifications?.hiddenModifications ?? []).includes(type)
    : shown.includes(type)
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

export interface ColorBy {
  type: ColorSchemeType
  tag?: string
  modifications?: ModificationColorBy
}

// On-disk shape of a persisted `colorBy`: the live ColorBy plus the retired
// scheme names — `methylation` (now modifications+fillUnmarked), `stranded` (an
// alias of firstOfPairStrand that no UI ever wrote) and `insertSizeGradient`
// (now plain insertSize). `normalizeColorBy` (colorSchemes.ts) upgrades all
// three at the read boundary, so no live code — menu, legend, extraction,
// shader dispatch — ever sees them.
export const LEGACY_COLOR_SCHEME_TYPES = [
  'methylation',
  'stranded',
  'insertSizeGradient',
] as const
export interface LegacyMethylationColorBy {
  type: 'methylation'
  modifications?: ModificationColorBy
}
export interface LegacyStrandedColorBy {
  type: 'stranded'
}
// Retired because it made the distinction it existed to draw *harder* to see.
// It bucketed exactly as `insertSize` and only differed in fill: an outlier
// lerped from the neutral toward its endpoint by severity. Since the long and
// short endpoints were a single hue apart (#ff0000 and #ffc0cb), two
// half-ramped reads on OPPOSITE sides of the band both came out faintly-tinted
// grey — closer to each other than the endpoints already were, and closest
// exactly where telling a deletion signature from an insertion one matters.
export interface LegacyInsertSizeGradientColorBy {
  type: 'insertSizeGradient'
}
export type PersistedColorBy =
  | ColorBy
  | LegacyMethylationColorBy
  | LegacyStrandedColorBy
  | LegacyInsertSizeGradientColorBy

// True when modification coloring should fill in unmarked canonical bases (the
// implicit-unmethylated cytosine walk) — the modifications+fillUnmarked sub-mode
// that subsumes the former standalone 'methylation' scheme. Reads only reach
// this after normalizeColorBy, so the legacy type is never seen here.
export function isFillUnmarkedMode(colorBy: ColorBy | undefined) {
  return (
    colorBy?.type === 'modifications' && !!colorBy.modifications?.fillUnmarked
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
// gating that legend swatch. The fill-unmarked walk always does; every other
// mode does exactly when `twoColor` is on — including two-color over a
// non-cytosine mod, which paints blue low-probability 6mA calls (extract.ts) and
// used to key no swatch for them at all.
export function paintsUnmodifiedState(colorBy: ColorBy | undefined) {
  return (
    isFillUnmarkedMode(colorBy) ||
    ((colorBy?.type === 'modifications' || colorBy?.type === 'bisulfite') &&
      !!colorBy.modifications?.twoColor)
  )
}

export interface TagFilter {
  tag: string
  value?: string
}

export interface FilterBy {
  flagExclude: number
  flagInclude: number
  readName?: string
  // Multiple tag filters are AND-ed (a read must pass every one). Kept plural so
  // independent quick-filters like HP (haplotype) and RG (read group) coexist
  // instead of clobbering each other.
  tagFilters?: TagFilter[]
}

// Legacy sessions stored a single `tagFilter`; fold it into `tagFilters` so
// every consumer only ever reads the plural form.
//
// The flag masks are backfilled here because `filterBy` is a `frozen` slot, so a
// hand-written config may set only `readName` or only `tagFilters` and leave the
// masks absent — `FilterBy` declares them required, and every reader (the
// worker's flag test, the menu's active-filter count, the dialog's checkboxes)
// assumes that. Without this, `filterBy: { readName: 'x' }` counted as two
// filters and tested reads against an undefined mask.
export function normalizeFilterBy(
  filterBy: Partial<FilterBy> & { tagFilter?: TagFilter },
): FilterBy {
  const { tagFilter, ...rest } = filterBy
  const base = { ...defaultFilterFlags, ...rest }
  return tagFilter !== undefined && base.tagFilters === undefined
    ? { ...base, tagFilters: [tagFilter] }
    : base
}

// In-track stacked grouping. `type` selects the per-read group-key generator
// (see shared/groupFeatures.ts); `tag` carries the tag name for tag/HP/RG
// grouping. Absent groupBy means a single ungrouped section.
export type GroupByType =
  | 'strand'
  | 'firstOfPairStrand'
  | 'tag'
  | 'pairOrientation'
  | 'splitRead'
  | 'mapq'
  | 'mateAssembly'

export interface GroupBy {
  type: GroupByType
  tag?: string
}

export interface SortedBy {
  type: string
  pos: number
  refName: string
  assemblyName: string
  tag?: string
}

// Bit flags stored in the Uint8Array `readChainHasSupp`, describing how a read's
// chain is split. Emitted by the worker (executeRenderAlignmentData), rewritten
// twice on the main thread (reconcileChainSuppAcrossRegions, then
// consensusChainStrandFrames), and consumed by exactly ONE reader:
// `readColorCategory` (colorUtils), which bakes it into `readColorCategories`
// once per recolour. Every fill path — GPU, Canvas2D, SVG export, legend — then
// reads that baked category and never this.
//
// It said "read by every fill path … read.slang is the one twin that must still
// be hand-mirrored", which stopped being true when the classification moved to
// the CPU: read.slang has no `chainHasSupp` and takes `colorCategory` (ATTR10).
// The array was still threaded into `ReadRegionFields` and `Canvas2DRegionData`
// on the strength of that sentence, where nothing read it.
//
// FLAGS, NOT A 0-4 ENUM, and the difference is not cosmetic. The two things this
// byte carries are answers to unrelated questions asked of different units —
// which way does this CHAIN point (a sign, from the chain's primary) and how did
// this MATE split away from its own primary (a category, from the pair) — and as
// consecutive integers the second could only be written by destroying the first.
// It was: `buildChainResultFields` overwrote the 1/2 frame with a 3/4 split kind,
// so a split read's frame was simply gone. Everything downstream then had to
// defend against that. `reconcileChainSuppAcrossRegions` skipped split reads
// outright rather than re-answer half a byte, `consensusChainStrandFrames`
// re-tested the enum's membership on all four of its loops, and the long comment
// in `readColorCategory` about a magnitude test being "correct only under
// unreachable-with-3-and-4" was describing the encoding rather than the data.
// Orthogonal bits let both answers be true at once, which they always were.
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

// Names in code order (index = code - 1). Single source for turning the numeric
// interbase code back into a name — used by the indicator hit-test and the
// coverage/indicator tooltip so the two can't drift.
export const INTERBASE_TYPE_NAMES = [
  'insertion',
  'softclip',
  'hardclip',
] as const
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
