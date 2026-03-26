export const OP_M = 0
export const OP_I = 1
export const OP_D = 2
export const OP_N = 3
export const OP_EQ = 7
export const OP_X = 8

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
