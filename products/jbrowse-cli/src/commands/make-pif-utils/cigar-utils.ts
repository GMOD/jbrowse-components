const cigarRegex = new RegExp(/([MIDNSHPX=])/)

export function parseCigar(cigar = ''): string[] {
  return cigar.split(cigarRegex).slice(0, -1)
}

export function flipCigar(cigar: string[]): string[] {
  const arr = []
  for (let i = cigar.length - 2; i >= 0; i -= 2) {
    arr.push(cigar[i])
    const op = cigar[i + 1]
    if (op === 'D') {
      arr.push('I')
    } else if (op === 'I') {
      arr.push('D')
    } else {
      arr.push(op)
    }
  }
  return arr
}

export function swapIndelCigar(cigar: string): string {
  return cigar.replaceAll('D', 'K').replaceAll('I', 'D').replaceAll('K', 'I')
}
