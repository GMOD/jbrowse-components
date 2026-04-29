export interface ModificationType {
  type: string
  base: string
  strand: string
}
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
  | 'samplot'

export interface ColorBy {
  type: string
  tag?: string
  modifications?: {
    twoColor?: boolean
    isolatedModification?: string
    threshold?: number
  }
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

interface BaseMismatch {
  start: number
  length: number
}

export interface SNPMismatch extends BaseMismatch {
  type: 'mismatch'
  base: string
  qual?: number
  altbase?: string
}

export interface InsertionMismatch extends BaseMismatch {
  type: 'insertion'
  insertlen: number
  insertedBases?: string
}

export interface DeletionMismatch extends BaseMismatch {
  type: 'deletion'
}

export interface SkipMismatch extends BaseMismatch {
  type: 'skip'
}

export interface ClipMismatch extends BaseMismatch {
  type: 'softclip' | 'hardclip'
  cliplen: number
}

export type Mismatch =
  | SNPMismatch
  | InsertionMismatch
  | DeletionMismatch
  | SkipMismatch
  | ClipMismatch

export interface ReducedFeature {
  name: string
  strand: number
  refName: string
  start: number
  end: number
  id: string
  flags: number
  tlen: number
  pair_orientation: string
  next_ref?: string
  next_pos?: number
  clipLengthAtStartOfRead: number
  SA?: string
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
