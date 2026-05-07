export interface CigarHitResult {
  type: 'mismatch' | 'insertion' | 'deletion'
  refPosition: number
  length: number
  base?: string
  insertionSeq?: string
}
