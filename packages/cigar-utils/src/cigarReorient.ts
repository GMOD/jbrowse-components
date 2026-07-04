// Reverse a CIGAR's op order and swap insertions<->deletions. Used to view an
// alignment from the opposite (query<->target) perspective on the reverse
// strand, where both the direction and the indel sense flip.
export function flipCigar(cigar: string) {
  const ops: [number, string][] = []
  let len = 0
  for (let i = 0, l = cigar.length; i < l; i++) {
    const c = cigar[i]!
    if (c >= '0' && c <= '9') {
      len = len * 10 + (c.charCodeAt(0) - 48)
    } else {
      ops.push([len, c])
      len = 0
    }
  }
  let result = ''
  for (let i = ops.length - 1; i >= 0; i--) {
    const [l, op] = ops[i]!
    result += l
    result += op === 'D' ? 'I' : op === 'I' ? 'D' : op
  }
  return result
}

// Swap insertions<->deletions in place, leaving op order untouched. This is the
// +-strand query<->target perspective flip, where only the indel sense reverses.
export function swapIndelCigar(cigar: string) {
  return cigar.replaceAll(/[DI]/g, op => (op === 'D' ? 'I' : 'D'))
}
