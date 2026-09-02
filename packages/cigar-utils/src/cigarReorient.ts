// Both re-orientations keep every byte of the CIGAR and change only which
// letter an indel wears (and, for the flip, the op order), so each is written
// straight into a byte buffer the size of its input rather than a string built
// op by op: 2-3x faster on a multi-kb PAF CIGAR, which make-pif does twice a
// row and orientAlignment does per fetched row.
function swapIndelByte(code: number) {
  return code === 68 ? 73 : code === 73 ? 68 : code
}

// Reverse a CIGAR's op order and swap insertions<->deletions. Used to view an
// alignment from the opposite (query<->target) perspective on the reverse
// strand, where both the direction and the indel sense flip.
export function flipCigar(cigar: string) {
  const src = new TextEncoder().encode(cigar)
  const n = src.length
  const out = new Uint8Array(n)
  let pos = n
  let start = 0
  for (let i = 0; i < n; i++) {
    const code = src[i]!
    if (code < 48 || code > 57) {
      pos -= i + 1 - start
      for (let k = start, p = pos; k < i; k++, p++) {
        out[p] = src[k]!
      }
      out[pos + i - start] = swapIndelByte(code)
      start = i + 1
    }
  }
  return new TextDecoder().decode(out.subarray(pos))
}

// Swap insertions<->deletions in place, leaving op order untouched. This is the
// +-strand query<->target perspective flip, where only the indel sense reverses.
export function swapIndelCigar(cigar: string) {
  const bytes = new TextEncoder().encode(cigar)
  for (let i = 0, n = bytes.length; i < n; i++) {
    bytes[i] = swapIndelByte(bytes[i]!)
  }
  return new TextDecoder().decode(bytes)
}
