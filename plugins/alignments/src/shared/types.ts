import type { CytosineContext } from '@jbrowse/modifications-utils'

// Coloring mode for paired-end arcs / read cloud. A deliberately smaller,
// separately-persisted vocabulary than the read-fill `ColorSchemeType`: arcs
// support only these three, and `'orientation'` is the arc name for the read
// scheme's `'pairOrientation'`. Kept distinct because it is a saved config value
// (renaming would need a migration) and the arc menu carries its own richer
// help text (see arcColorOptions in menus/colorBy.tsx). getArcColorType
// (features/arcs/compute.ts) mirrors the matching read-fill logic.
export type ArcColorByType =
  | 'insertSizeAndOrientation'
  | 'insertSize'
  | 'orientation'

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
// 'modifications' with different config, 'stranded' aliases 'firstOfPairStrand'.
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
  | 'insertSizeGradient'
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
  | 'insertSizeGradient'
  | 'firstOfPairStrand'
  | 'stranded'
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

// On-disk shape of a persisted `colorBy`: the live ColorBy plus the deprecated
// standalone `methylation` scheme, now expressed as modifications+fillUnmarked.
// `normalizeColorBy` (colorSchemes.ts) upgrades it at the read boundary so no
// live code ever sees `type: 'methylation'`.
export interface LegacyMethylationColorBy {
  type: 'methylation'
  modifications?: ModificationColorBy
}
export type PersistedColorBy = ColorBy | LegacyMethylationColorBy

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
export function normalizeFilterBy(
  filterBy: FilterBy & { tagFilter?: TagFilter },
): FilterBy {
  const { tagFilter, ...rest } = filterBy
  return tagFilter !== undefined && rest.tagFilters === undefined
    ? { ...rest, tagFilters: [tagFilter] }
    : rest
}

// In-track stacked grouping. `type` selects the per-read group-key generator
// (see shared/groupFeatures.ts); `tag` carries the tag name for tag/HP/RG
// grouping. Absent groupBy means a single ungrouped section.
export type GroupByType =
  | 'strand'
  | 'firstOfPairStrand'
  | 'tag'
  | 'pairOrientation'
  | 'supplementary'
  | 'duplicate'
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

const typeLabels: Record<string, string> = {
  insertion: 'Insertion',
  softclip: 'Soft clip',
  hardclip: 'Hard clip',
  snp: 'SNP',
  modification: 'Modification',
}

export function getInterbaseTypeLabel(type: string) {
  return typeLabels[type] ?? type
}
