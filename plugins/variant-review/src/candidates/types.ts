export type CandidateId = string

export type CandidateKind =
  | 'snv'
  | 'mnv'
  | 'del'
  | 'ins'
  | 'complex'
  | 'symbolic'
  | 'breakend'

// The sort types `LinearAlignmentsDisplay`'s `sortedBy` slot understands that
// a VCF record can name a column for.
export type CandidateSortType = 'basePair' | 'insertion'

export interface CandidateSort {
  type: CandidateSortType
  // 0-based absolute genomic coordinate, what `SortedBy.pos` is
  pos: number
}

export interface CandidateVariant {
  id: CandidateId
  // canonical
  assemblyName: string
  // canonical for the assembly: the refName of the assembly region the record
  // was fetched under, never the VCF's CHROM
  refName: string
  // 0-based, VCF POS - 1
  start: number
  // 0-based exclusive, as VcfFeature computes it
  end: number
  // VCF POS, for display and export only
  pos1: number
  ref: string
  alt: string[]
  vcfId?: string
  filter?: string[]
  qual?: number
  // only the configured `infoFields`, never all of INFO
  info: Record<string, unknown>
  kind: CandidateKind
  // undefined: no column to sort on (symbolic, breakend, `*`, `.`)
  sort?: CandidateSort
  // `feature.id()`, adapter-internal; only for opening the feature's details,
  // never a key decisions are stored under
  sourceFeatureId: string
}

export type ReviewDecision = 'accepted' | 'rejected' | 'flagged'

export interface DecisionRecord {
  // 'unreviewed' is absence from the map
  decision: ReviewDecision
  note?: string
  // ISO 8601, only when the plugin config's `recordTimestamps` is on
  timestamp?: string
}
