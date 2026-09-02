export interface PlinkLDRecord {
  chrA: string
  bpA: number
  snpA: string
  chrB: string
  bpB: number
  snpB: string
  // Absent when the file has no R2 column at all (a `--r2 dprime`-only emit),
  // which is a different thing from a pair whose r² is zero. Reported as
  // absent so a caller downgrades to D' rather than painting a matrix of
  // confident zeros — see `resolveMetric`.
  r2?: number
  dprime?: number
  mafA?: number
  mafB?: number
}

export interface PlinkLDHeader {
  chrAIdx: number
  bpAIdx: number
  snpAIdx: number
  chrBIdx: number
  bpBIdx: number
  snpBIdx: number
  r2Idx: number
  dprimeIdx: number
  mafAIdx: number
  mafBIdx: number
}
