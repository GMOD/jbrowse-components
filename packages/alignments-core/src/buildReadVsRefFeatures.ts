import {
  featurizeSA,
  getClip,
  getLength,
  getLengthSansClipping,
} from '@jbrowse/cigar-utils'

import { getTag } from './getTag.ts'
import { SAM_FLAG_SUPPLEMENTARY } from './samFlags.ts'

import type { Feature } from '@jbrowse/core/util'

export interface ReadVsRefMate {
  refName: string
  start: number
  end: number
  syntenyId?: number
  uniqueId?: string
}

export interface ReadVsRefFeature {
  refName: string
  start: number
  end: number
  strand: number
  CIGAR: string
  clipLengthAtStartOfRead: number
  uniqueId: string
  seqLength?: number
  syntenyId?: number
  mate: ReadVsRefMate
  [key: string]: unknown
}

export interface ReadVsRefFeatures {
  // Primary alignment plus its supplementary alignments as a single synteny
  // feature list, sorted along the read by clip length at the start of the
  // read. Each carries a `mate` describing its span on the synthetic read
  // assembly.
  features: ReadVsRefFeature[]
  // Full read length. Taken from the primary's CIGAR (carried in SA[0]) when
  // `feature` is itself a supplementary alignment, since that CIGAR only covers
  // the alignment's own slice of the read.
  totalLength: number
  readName: string
  seq: string | undefined
}

// Shared core for the "read vs ref" launchers (linear synteny + dotplot). Turns
// one alignment feature into the synthetic primary+supplementary feature list
// both views draw against the synthetic read assembly.
export function buildReadVsRefFeatures(feature: Feature): ReadVsRefFeatures {
  const cigar = feature.get('CIGAR') as string
  const flags = feature.get('flags') as number
  const strand = feature.get('strand')
  const readName = feature.get('name')!
  const seq = feature.get('seq') as string | undefined
  const SA = getTag(feature, 'SA') as string | undefined
  const clipLengthAtStartOfRead = getClip(cigar, 1)
  const suppAlns = featurizeSA(SA, feature.id(), strand, readName, true)

  const primary = {
    ...(feature.toJSON() as Record<string, unknown>),
    clipLengthAtStartOfRead,
    strand: 1,
    mate: {
      refName: readName,
      start: clipLengthAtStartOfRead,
      end: clipLengthAtStartOfRead + getLengthSansClipping(cigar),
    },
  }

  const totalLength = getLength(
    flags & SAM_FLAG_SUPPLEMENTARY ? suppAlns[0]!.CIGAR : cigar,
  )

  const features = [primary, ...suppAlns].sort(
    (a, b) => a.clipLengthAtStartOfRead - b.clipLengthAtStartOfRead,
  ) as ReadVsRefFeature[]

  return { features, totalLength, readName, seq }
}
