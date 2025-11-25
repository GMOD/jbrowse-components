import type { Feature } from '@jbrowse/core/util'

export type SkipMap = Record<
  string,
  {
    score: number
    feature: unknown
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
  probabilityTotal?: number
  probabilityCount?: number
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

// Mismatch type constants (bitwise flags for performance)
export const MISMATCH_TYPE_MISMATCH = 1
export const MISMATCH_TYPE_INSERTION = 2
export const MISMATCH_TYPE_DELETION = 4
export const MISMATCH_TYPE_SKIP = 8
export const MISMATCH_TYPE_SOFTCLIP = 16
export const MISMATCH_TYPE_HARDCLIP = 32

// Bitwise masks for common type groupings
export const MISMATCH_TYPE_INTERBASE_MASK =
  MISMATCH_TYPE_INSERTION | MISMATCH_TYPE_SOFTCLIP | MISMATCH_TYPE_HARDCLIP
export const MISMATCH_TYPE_CLIP_MASK =
  MISMATCH_TYPE_SOFTCLIP | MISMATCH_TYPE_HARDCLIP
export const MISMATCH_TYPE_DELSKIP_MASK =
  MISMATCH_TYPE_DELETION | MISMATCH_TYPE_SKIP

export interface Mismatch {
  qual?: number
  start: number
  length: number
  insertedBases?: string
  type: number
  base: string
  altbase?: string
  seq?: string
  cliplen?: number
}

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
  clipPos: number
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
