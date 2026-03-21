function isCsOpChar(ch: string | undefined) {
  return ch === ':' || ch === '*' || ch === '+' || ch === '-'
}

// Swap cs tag perspective: *XY → *YX, +seq → -seq, -seq → +seq
export function flipCs(cs: string) {
  let result = ''
  let i = 0
  while (i < cs.length) {
    const ch = cs[i]!
    if (ch === ':') {
      const start = i
      i++
      while (i < cs.length && cs[i]! >= '0' && cs[i]! <= '9') {
        i++
      }
      result += cs.slice(start, i)
    } else if (ch === '*') {
      result += `*${cs[i + 2]}${cs[i + 1]}`
      i += 3
    } else if (ch === '+' || ch === '-') {
      const flipped = ch === '+' ? '-' : '+'
      i++
      const start = i
      while (i < cs.length && !isCsOpChar(cs[i])) {
        i++
      }
      result += `${flipped}${cs.slice(start, i)}`
    } else {
      i++
    }
  }
  return result
}

export function csToCigar(cs: string) {
  let cigar = ''
  let i = 0
  while (i < cs.length) {
    const ch = cs[i]!
    if (ch === ':') {
      i++
      let num = 0
      while (i < cs.length && cs[i]! >= '0' && cs[i]! <= '9') {
        num = num * 10 + (cs.charCodeAt(i) - 48)
        i++
      }
      if (num > 0) {
        cigar += `${num}=`
      }
    } else if (ch === '*') {
      i += 3
      cigar += '1X'
    } else if (ch === '+' || ch === '-') {
      const op = ch === '+' ? 'I' : 'D'
      i++
      let len = 0
      while (
        i < cs.length &&
        cs[i] !== ':' &&
        cs[i] !== '*' &&
        cs[i] !== '+' &&
        cs[i] !== '-'
      ) {
        len++
        i++
      }
      if (len > 0) {
        cigar += `${len}${op}`
      }
    } else {
      i++
    }
  }
  return cigar
}
