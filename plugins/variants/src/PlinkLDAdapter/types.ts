export interface PlinkLDRecord {
  chrA: string
  bpA: number
  snpA: string
  chrB: string
  bpB: number
  snpB: string
  r2: number
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
