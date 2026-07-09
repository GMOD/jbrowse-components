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
  readIndex: number
  start: number
  end: number
  type: 'deletion' | 'skip'
  strand: number
  featureStrand: number
}

export interface MismatchData {
  readIndex: number
  position: number
  base: number
  strand: number // -1=reverse, 1=forward
  qual: number // per-base Phred quality; 0 when the read has no QUAL ('*')
}

export interface InsertionData {
  readIndex: number
  position: number
  length: number
  sequence?: string
}

export interface SoftclipData {
  readIndex: number
  position: number // alignment edge (for coverage area interbase indicator)
  clipStart: number // actual genomic start of the soft-clipped bases
  length: number
  sequence?: string // the soft-clipped bases from the read sequence
}

export interface HardclipData {
  readIndex: number
  position: number
  length: number
}

export interface ModificationEntry {
  readIndex: number
  position: number // absolute genomic position
  base: string // canonical base (e.g., 'C' for 5mC)
  modType: string // modification type code (e.g., 'm', 'h')
  strand: number // -1=reverse, 1=forward
  r: number
  g: number
  b: number
  prob: number // probability (0-1)
  // The "no modification" / unmethylated bucket (IGV's NONE_<base>). modType
  // stays the canonical mod ('m'/'h') so the coverage denominator and simplex
  // logic are shared with the modified bucket, but `prob` is the confidence the
  // base is UNmodified and tooltips label it "Unmodified <base>", not "5mC".
  noMod?: boolean
}
