function isBaseChar(ch: string | undefined) {
  return ch !== undefined && /[A-Za-z]/.test(ch)
}

// Convert a minimap2 `cs` difference string (https://github.com/lh3/minimap2#cs)
// to a standard CIGAR. Short form (`:N` match, `*ab` substitution, `+seq`
// insertion, `-seq` deletion), long form (`=SEQ` match), and `~` splice/introns
// are handled: matches -> `=`, substitutions -> `X`, insertions -> `I`,
// deletions -> `D`, introns -> `N`. Sequence bases are dropped so the result
// reorients with the same flipCigar/swapIndelCigar helpers as a `cg` CIGAR.
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
  function countBases(start: number) {
    let j = start
    while (j < cs.length && isBaseChar(cs[j])) {
      j++
    }
    return j - start
  }
  function countDigits(start: number) {
    let j = start
    let len = 0
    while (j < cs.length && cs.charCodeAt(j) >= 48 && cs.charCodeAt(j) <= 57) {
      len = len * 10 + (cs.charCodeAt(j) - 48)
      j++
    }
    return { len, next: j }
  }

  let i = 0
  while (i < cs.length) {
    const c = cs[i]!
    if (c === ':') {
      const { len, next } = countDigits(i + 1)
      push(len, '=')
      i = next
    } else if (c === '=') {
      const n = countBases(i + 1)
      push(n, '=')
      i = i + 1 + n
    } else if (c === '*') {
      push(1, 'X')
      i += 3
    } else if (c === '+') {
      const n = countBases(i + 1)
      push(n, 'I')
      i = i + 1 + n
    } else if (c === '-') {
      const n = countBases(i + 1)
      push(n, 'D')
      i = i + 1 + n
    } else if (c === '~') {
      const { len, next } = countDigits(i + 3)
      push(len, 'N')
      i = next + 2
    } else {
      i++
    }
  }
  let result = ''
  for (const [len, op] of ops) {
    result += len
    result += op
  }
  return result
}
