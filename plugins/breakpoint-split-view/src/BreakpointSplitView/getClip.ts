const startClip = /(\d+)[SH]$/
const endClip = /^(\d+)([SH])/

export function getClip(cigar: string, strand: number) {
  return strand === -1
    ? +(startClip.exec(cigar)?.[1] ?? 0)
    : +(endClip.exec(cigar)?.[1] ?? 0)
}
