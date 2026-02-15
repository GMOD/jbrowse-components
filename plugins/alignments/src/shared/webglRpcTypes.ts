export interface FeatureData {
  id: string
  name: string
  start: number
  end: number
  flags: number
  mapq: number
  insertSize: number
  pairOrientation: number // 0=unknown, 1=LR, 2=RL, 3=RR, 4=LL
  strand: number // -1=reverse, 0=unknown, 1=forward
}

export interface ChainFeatureData extends FeatureData {
  refName: string
  nextRef: string | undefined
  pairOrientationStr: string | undefined
  templateLength: number
}

export interface GapData {
  featureId: string
  start: number
  end: number
  type: 'deletion' | 'skip'
  strand: number
  featureStrand: number
}

export interface MismatchData {
  featureId: string
  position: number
  base: number
  strand: number // -1=reverse, 1=forward
}

export interface InsertionData {
  featureId: string
  position: number
  length: number
  sequence?: string
}

export interface SoftclipData {
  featureId: string
  position: number
  length: number
}

export interface HardclipData {
  featureId: string
  position: number
  length: number
}

export interface ModificationEntry {
  featureId: string
  position: number // absolute genomic position
  base: string // canonical base (e.g., 'C' for 5mC)
  modType: string // modification type code (e.g., 'm', 'h')
  isSimplex: boolean
  strand: number // -1=reverse, 1=forward
  r: number
  g: number
  b: number
  prob: number // probability (0-1)
}
