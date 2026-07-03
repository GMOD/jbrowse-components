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

export interface ModificationColorBy {
  twoColor?: boolean
  // modification type codes to hide; absent/empty means show every detected
  // type. Stored as the hidden set (not the shown set) so types newly
  // discovered in the data default to visible.
  hiddenModifications?: string[]
  threshold?: number
  // cytosine context for the methylation view; absent means CpG. CHG/CHH support
  // plant methylation. Only consumed in methylation mode (getMethBins).
  cytosineContext?: CytosineContext
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
  | 'methylation'
  | 'bisulfite'

export interface ColorBy {
  type: ColorSchemeType
  tag?: string
  modifications?: ModificationColorBy
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
