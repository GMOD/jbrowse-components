import type { CytosineContext } from '@jbrowse/modifications-utils'

export interface ModificationTypeWithColor {
  color: string
  type: string
  base: string
  strand: string
}

export type ArcColorByType =
  'insertSizeAndOrientation' | 'insertSize' | 'orientation'

// Minimum modification-call probability (%) shown by default. Stored threshold
// is omitted at this value so default sessions don't carry a redundant field.
export const DEFAULT_MODIFICATION_THRESHOLD = 10

// A `modifications` fragment carrying the probability threshold, but only when
// non-default — so default sessions don't persist a redundant field. Single
// source for the "omit at default" rule shared by the scheme setters and the
// threshold slider.
export function modificationThresholdField(threshold: number) {
  return threshold === DEFAULT_MODIFICATION_THRESHOLD ? {} : { threshold }
}

export interface ModificationColorBy {
  twoColor?: boolean
  // modification type codes to hide; absent/empty means show every detected
  // type. Stored as the hidden set (not the shown set) so types newly
  // discovered in the data default to visible.
  hiddenModifications?: string[]
  // explicit allow-list of modification type codes to show. When non-empty it
  // wins over hiddenModifications: ONLY these types render, so a "6mA only"
  // view (shownModifications: ['a']) stays 6mA-only even if the basecaller also
  // emits 5mC/5hmC on the same reads. Absent/empty falls back to the
  // hiddenModifications default (show every detected type).
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
// shownModifications (allow-list) wins when present and non-empty; otherwise
// hiddenModifications (deny-list) is subtracted from the all-visible default.
// Shared by the worker extract filter, the legend, and the color-by menu so the
// three can't drift.
export function isModificationTypeVisible(
  modifications: ModificationColorBy | undefined,
  type: string,
) {
  const shown = modifications?.shownModifications
  return shown?.length
    ? shown.includes(type)
    : !(modifications?.hiddenModifications ?? []).includes(type)
}

// Shader color-scheme dispatch paths — the distinct branches read.slang
// actually implements. Several ColorSchemeTypes share one path: perBaseQuality/
// perBaseLetter paint over the 'normal' body, methylation/bisulfite reuse
// 'modifications' with different config, 'stranded' aliases 'firstOfPairStrand'.
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
