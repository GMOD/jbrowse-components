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
  averageProbability?: number
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
  delskips: PreBinType
  noncov: PreBinType
}
