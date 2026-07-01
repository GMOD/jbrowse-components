// Two-pass: collect token start indices, then walk backward slicing the digit
// run directly from the original string — avoids intermediate number/op arrays.
export function flipCigar(cigar: string): string {
  const starts: number[] = []
  let i = 0
  while (i < cigar.length) {
    starts.push(i)
    while (cigar.charCodeAt(i) >= 48 && cigar.charCodeAt(i) <= 57) {
      i++
    }
    i++ // skip op char
  }
  let result = ''
  for (let j = starts.length - 1; j >= 0; j--) {
    const s = starts[j]!
    const end = j + 1 < starts.length ? starts[j + 1]! : cigar.length
    const op = cigar[end - 1]!
    result +=
      cigar.slice(s, end - 1) + (op === 'D' ? 'I' : op === 'I' ? 'D' : op)
  }
  return result
}

export function swapIndelCigar(cigar: string): string {
  return cigar.replaceAll(/[DI]/g, op => (op === 'D' ? 'I' : 'D'))
}
