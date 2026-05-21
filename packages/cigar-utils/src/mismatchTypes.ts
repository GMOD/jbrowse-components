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
