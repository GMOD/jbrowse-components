export {
  CIGAR_D,
  CIGAR_EQ,
  CIGAR_I,
  CIGAR_M,
  CIGAR_N,
  CIGAR_X,
} from '@jbrowse/alignments-core'

export function isDigit(ch: string) {
  return ch >= '0' && ch <= '9'
}

export function isCsOpChar(ch: string | undefined) {
  return ch === ':' || ch === '*' || ch === '+' || ch === '-'
}

export function parseCsSeqLen(cs: string, start: number) {
  let i = start
  while (i < cs.length && !isCsOpChar(cs[i])) {
    i++
  }
  return i - start
}
