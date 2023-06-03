export interface SkipMap {
  [key: string]: {
    score: number
    feature: unknown
    start: number
    end: number
    strand: number
    xs: string
  }
}

// bins contain:
// - cov feature if they contribute to coverage
// - noncov are insertions/clip features that don't contribute to coverage
// - delskips deletions or introns that don't contribute to coverage
export interface BinType {
  total?: number
  strands?: { [key: string]: number }
}

export interface Bin {
  refbase?: string
  total: number
  all: number
  ref: number
  '-1': number
  '0': number
  '1': number
  lowqual: BinType
  cov: BinType
  delskips: BinType
  noncov: BinType
}
