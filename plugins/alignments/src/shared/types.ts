import type { CytosineContext } from '@jbrowse/modifications-utils'

export interface ModificationTypeWithColor {
  color: string
  type: string
  base: string
  strand: string
}

export type ArcColorByType =
  | 'insertSizeAndOrientation'
  | 'insertSize'
  | 'orientation'

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

// Every color-by scheme; mirrors the keys of COLOR_BY_TO_SCHEME in the display
// model. 'stranded' is a legacy alias for firstOfPairStrand; 'perBaseQuality'
// renders via the normal shader path. Typing this (vs a bare string) catches
// scheme-name typos at every construction site.
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
  | 'baseQuality'
  | 'perBaseQuality'
  | 'tag'
  | 'modifications'
  | 'methylation'
  | 'bisulfite'

export interface ColorBy {
  type: ColorSchemeType
  tag?: string
  modifications?: ModificationColorBy
}

export interface FilterBy {
  flagExclude: number
  flagInclude: number
  readName?: string
  tagFilter?: {
    tag: string
    value?: string
  }
}

export interface SortedBy {
  type: string
  pos: number
  refName: string
  assemblyName: string
  tag?: string
}

export interface ChainStats {
  max: number
  min: number
  upper: number
  lower: number
}

// Numeric interbase type codes stored in Uint8Array interbaseTypes.
// Must match the order used in shared/buildInterbaseArrays addItems calls.
export const INTERBASE_INSERTION = 1
export const INTERBASE_SOFTCLIP = 2
export const INTERBASE_HARDCLIP = 3

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
