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
  probabilities: number[]
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

export interface Mismatch {
  qual?: number
  start: number
  length: number
  type: string
  base: string
  altbase?: string
  seq?: string
  cliplen?: number
}
