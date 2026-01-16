import type { MismatchCallback } from './forEachMismatchTypes.ts'
import type { Feature } from '@jbrowse/core/util'

export type SkipMap = Record<
  string,
  {
    score: number
    start: number
    end: number
    strand: number
    effectiveStrand: number
  }
>

export interface BinEntry {
  entryDepth: number
  '-1': number
  '0': number
  '1': number
  avgProbability?: number
  avgLength?: number
  minLength?: number
  maxLength?: number
  topSequence?: string
}

type BinType = Record<string, BinEntry>

// bins contain:
// - snps feature if they contribute to coverage
// - mods feature for read modifications like methylation
// - noncov are insertions/clip features that don't contribute to coverage
// - delskips deletions or introns that don't contribute to coverage
export interface BaseCoverageBin {
  refbase?: string
  depth: number
  readsCounted: number
  ref: BinEntry
  snps: BinType
  mods: BinType
  nonmods: BinType
  delskips: BinType
  noncov: BinType
}

export interface PreBinEntry {
  entryDepth: number
  '-1': number
  '0': number
  '1': number
  probabilityTotal: number
  probabilityCount: number
  lengthTotal: number
  lengthCount: number
  lengthMin: number
  lengthMax: number
  sequenceCounts?: Map<string, number>
  // Computed fields added during finalization
  avgProbability?: number
  avgLength?: number
  minLength?: number
  maxLength?: number
  topSequence?: string
}

type PreBinType = Record<string, PreBinEntry>

// bins contain:
// - snps feature if they contribute to coverage
// - mods feature for read modifications like methylation
// - nonmods feature for read modifications like methylation (2-color)
// - noncov are insertions/clip features that don't contribute to coverage
// - delskips deletions or introns that don't contribute to coverage
export interface PreBaseCoverageBin extends PreBaseCoverageBinSubtypes {
  refbase?: string
  depth: number
  readsCounted: number
  ref: PreBinEntry
}

export interface PreBaseCoverageBinSubtypes {
  snps: PreBinType
  mods: PreBinType
  nonmods: PreBinType
  delskips: PreBinType
  noncov: PreBinType
}

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

export interface ChainData {
  stats?: ChainStats
  chains: Feature[][]
}

export type MismatchType =
  | 'mismatch'
  | 'insertion'
  | 'deletion'
  | 'skip'
  | 'softclip'
  | 'hardclip'

export interface FeatureWithMismatchIterator extends Feature {
  forEachMismatch(callback: MismatchCallback): void
}
