import {
  featurizeSA,
  getClip,
  getLength,
  getLengthSansClipping,
} from './mismatchParser.ts'
import { SAM_FLAG_SUPPLEMENTARY } from './samFlags.ts'

export interface ReadVsRefMate {
  refName: string
  start: number
  end: number
  syntenyId: number
  uniqueId: string
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
  syntenyId: number
  mate: ReadVsRefMate
  [key: string]: unknown
}

// The serialized alignment record this reads. Deliberately not a `Feature`:
// this package has no framework deps, and every caller either already holds a
// serialized record or can produce one with `feature.toJSON()`.
export interface ReadVsRefInput {
  uniqueId: string
  refName: string
  start: number
  end: number
  CIGAR?: string
  flags?: number
  strand?: number
  name?: string
  seq?: string
  tags?: Record<string, unknown>
  [key: string]: unknown
}

export interface ReadVsRefFeatures {
  // Primary alignment plus its supplementary alignments as a single synteny
  // feature list, sorted along the read by clip length at the start of the
  // read. Each carries a `mate` describing its span on the synthetic read
  // assembly, and a `syntenyId` it shares with that mate.
  features: ReadVsRefFeature[]
  // Full read length. Taken from the primary's CIGAR (carried in SA[0]) when
  // `feature` is itself a supplementary alignment, since that CIGAR only covers
  // the alignment's own slice of the read.
  totalLength: number
  readName: string
  // The read's bases, laid out over [0, totalLength) of the synthetic read
  // assembly — so only present when they actually span the read. A hard-clipped
  // supplementary alignment carries just its own slice, which pasted at offset
  // 0 would render the wrong base at every position of the sequence track.
  seq: string | undefined
}

/**
 * #api
 * Decompose one alignment record plus its SA tag into the segments of the split
 * read, ordered along the read. The layer above `featurizeSA`: it folds the
 * record itself in as one more segment, in the same normalized read coordinate
 * space the SA entries are put in, and pairs each segment with a `mate`
 * describing its span on the read.
 *
 * This is what the "read vs ref" launchers (linear synteny + dotplot) draw
 * against a synthetic read assembly, and what the alignments feature-detail
 * widget lists split-read junctions from.
 *
 * `getCanonicalRefName` resolves each segment's refName against the reference
 * assembly's aliases: a BAM whose header says `chr1` against a FASTA whose
 * refName is `1` otherwise yields regions no track can be opened on. Optional
 * only because a caller may not have the assembly in hand; pass it when you do.
 */
export function buildReadVsRefFeatures(
  feature: ReadVsRefInput,
  getCanonicalRefName?: (refName: string) => string | undefined,
): ReadVsRefFeatures {
  const {
    CIGAR: cigar = '',
    flags = 0,
    strand,
    name: readName = '',
    seq,
    tags,
    uniqueId,
  } = feature
  const SA = tags?.SA
  const suppAlns = featurizeSA(
    typeof SA === 'string' ? SA : undefined,
    uniqueId,
    strand,
    readName,
    true,
  )

  // getClip(cigar, 1), not getClip(cigar, strand): `normalize` puts every SA
  // entry in the *query's reference orientation*, so the record itself has to be
  // measured in that frame too. Measuring it in the read's own 5'->3' frame
  // reads the clip off the far end of a reverse-strand CIGAR, which drops the
  // primary into the wrong place along the read and mis-sorts the segments.
  const clipLengthAtStartOfRead = getClip(cigar, 1)

  const primary = {
    ...feature,
    clipLengthAtStartOfRead,
    strand: 1,
    mate: {
      refName: readName,
      start: clipLengthAtStartOfRead,
      end: clipLengthAtStartOfRead + getLengthSansClipping(cigar),
    },
  }

  // A supplementary CIGAR covers only its own slice of the read, so its own
  // length is the read length only when the aligner emitted the clipping ops.
  // SA[0] is the primary by convention. `?? cigar` covers a supplementary with
  // no SA tag at all, which has nothing better to measure against.
  const totalLength = getLength(
    (flags & SAM_FLAG_SUPPLEMENTARY ? suppAlns[0]?.CIGAR : undefined) ?? cigar,
  )

  const features = ([primary, ...suppAlns] as ReadVsRefFeature[])
    .sort((a, b) => a.clipLengthAtStartOfRead - b.clipLengthAtStartOfRead)
    // syntenyId is assigned after the sort so it also reads as the segment's
    // index along the read; the mate shares it, which is how the synteny
    // renderer pairs the two sides of one alignment.
    .map((f, idx) => ({
      ...f,
      refName: getCanonicalRefName?.(f.refName) ?? f.refName,
      syntenyId: idx,
      mate: { ...f.mate, syntenyId: idx, uniqueId: `${f.uniqueId}_mate` },
    }))

  return {
    features,
    totalLength,
    readName,
    // Only hand back bases that line up with the read coordinate system the
    // synthetic assembly is built in. A hard-clipped supplementary's SEQ is its
    // own slice, and the sequence track would show it at the wrong offset with
    // nothing marking it as partial; no sequence beats a wrong one.
    seq: seq && seq.length >= totalLength ? seq : undefined,
  }
}
