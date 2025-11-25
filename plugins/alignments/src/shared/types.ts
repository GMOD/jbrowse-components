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

// Entry array indices for strand counts
export const ENTRY_DEPTH = 0
export const ENTRY_NEG = 1 // strand -1
export const ENTRY_ZERO = 2 // strand 0
export const ENTRY_POS = 3 // strand 1
export const ENTRY_PROB_TOTAL = 4
export const ENTRY_PROB_COUNT = 5

// Entry category prefixes for flat map keys
export const CAT_SNP = 's:' // e.g., 's:A', 's:C'
export const CAT_MOD = 'm:' // e.g., 'm:h' for mod_h
export const CAT_NONMOD = 'n:' // e.g., 'n:h' for nonmod_h
export const CAT_DELSKIP = 'd:' // e.g., 'd:deletion'
export const CAT_NONCOV = 'c:' // e.g., 'c:insertion'

// Flat entry: [entryDepth, negCount, zeroCount, posCount]
// For mods with probability: [entryDepth, neg, zero, pos, probTotal, probCount]
export type FlatEntry = Uint32Array

// Flat bin structure for performance
export interface FlatBaseCoverageBin {
  refbase?: string
  depth: number
  readsCounted: number
  // ref counts flattened
  refDepth: number
  refNeg: number
  refZero: number
  refPos: number
  // All variable entries in a single map with coded keys
  // Key format: 'category:field' (e.g., 's:A', 'm:h', 'c:insertion')
  entries: Map<string, FlatEntry>
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
export const MISMATCH_TYPE_MODIFICATION = 64 // For FlatbushItem mouseover

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
