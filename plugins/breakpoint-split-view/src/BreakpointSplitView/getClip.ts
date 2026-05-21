// clip at the end of the CIGAR string = start of a reverse-strand read
const trailingClip = /(\d+)[SH]$/
// clip at the start of the CIGAR string = start of a forward-strand read
const leadingClip = /^(\d+)([SH])/

export function getClip(cigar: string, strand: number) {
  return strand === -1
    ? +(trailingClip.exec(cigar)?.[1] ?? 0)
    : +(leadingClip.exec(cigar)?.[1] ?? 0)
}
