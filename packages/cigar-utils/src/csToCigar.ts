import { forEachCsOp } from './csOps.ts'

// Convert a minimap2 `cs` difference string to a standard CIGAR: matches -> `=`,
// substitutions -> `X`, insertions -> `I`, deletions -> `D`, introns -> `N`.
// Sequence bases are dropped so the result reorients with the same
// flipCigar/swapIndelCigar helpers as a `cg` CIGAR. The grammar itself is
// forEachCsOp's; this is only the op mapping.
export function csToCigar(cs: string) {
  const ops: [number, string][] = []
  function push(len: number, op: string) {
    if (len > 0) {
      const last = ops[ops.length - 1]
      if (last?.[1] === op) {
        last[0] += len
      } else {
        ops.push([len, op])
      }
    }
  }
  forEachCsOp(cs, (op, refLen, queryLen) => {
    if (op === '*') {
      push(1, 'X')
    } else if (op === '+') {
      push(queryLen, 'I')
    } else if (op === '-') {
      push(refLen, 'D')
    } else if (op === '~') {
      push(refLen, 'N')
    } else {
      push(refLen, '=')
    }
  })
  let result = ''
  for (const [len, op] of ops) {
    result += len
    result += op
  }
  return result
}
