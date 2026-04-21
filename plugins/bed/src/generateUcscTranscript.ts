import type { MinimalFeature } from './types.ts'

export function isUcscTranscript({
  thickStart,
  thickEnd,
  blockCount,
  strand,
}: {
  thickStart?: number
  thickEnd?: number
  blockCount?: number
  strand?: number
}) {
  // strand===0 means unstranded - likely not a gene
  return (
    thickStart !== undefined &&
    thickEnd !== undefined &&
    thickStart !== thickEnd &&
    blockCount &&
    strand !== 0
  )
}

// phase = (3 - cumulative_cds_width % 3) % 3, computed in transcriptional order
function calculatePhasesFromCds(
  cdsRegions: { start: number; end: number }[],
  strand: number,
) {
  const sorted = [...cdsRegions].sort((a, b) =>
    strand > 0 ? a.start - b.start : b.start - a.start,
  )

  const phaseMap = new Map<number, number>()
  let cumulativeWidth = 0

  for (const cds of sorted) {
    const phase = (3 - (cumulativeWidth % 3)) % 3
    phaseMap.set(cds.start, phase)
    cumulativeWidth += cds.end - cds.start
  }

  return phaseMap
}

// convert UCSC exonFrames (0,1,2) to GFF phase: frame 0→0, frame 1→2, frame 2→1
// UCSC frame = bases from start of codon; GFF phase = bases to skip to reach next codon
// https://genome.ucsc.edu/FAQ/FAQformat.html#format1 (bigGenePred exonFrames)
// https://github.com/The-Sequence-Ontology/Specifications/blob/master/gff3.md (phase)
function frameToPhase(frame: number) {
  return (3 - frame) % 3
}

interface UcscTranscriptInput {
  uniqueId: string
  strand?: number
  thickStart: number
  thickEnd: number
  refName: string
  start: number
  end: number
  subfeatures: MinimalFeature[]
  [key: string]: unknown
}

interface UcscTranscriptOutput {
  uniqueId: string
  strand: number
  type: string
  refName: string
  start: number
  end: number
  subfeatures: MinimalFeature[]
  [key: string]: unknown
}

export function generateUcscTranscript(
  data: UcscTranscriptInput,
): UcscTranscriptOutput {
  const { strand = 0, uniqueId, start, end, ...rest } = data
  const {
    subfeatures: oldSubfeatures,
    thickStart,
    thickEnd,
    refName,
    chrom: _1,
    chromStart: _2,
    chromEnd: _3,
    chromStarts: _4,
    blockStarts: _5,
    blockSizes: _6,
    blockCount: _7,
    ...rest2
  } = rest

  // exonFrames from bigGenePred - the @gmod/bed parser returns it in genomic order
  const exonFrames = (rest2.exonFrames ?? rest2._exonFrames) as
    | number[]
    | undefined

  const feats = oldSubfeatures
    .filter(child => child.type === 'block')
    .sort((a, b) => a.start - b.start)

  const fiveUTR = strand > 0 ? 'five_prime_UTR' : 'three_prime_UTR'
  const threeUTR = strand > 0 ? 'three_prime_UTR' : 'five_prime_UTR'

  const { cdsEndStat, cdsStartStat } = rest2
  if (cdsStartStat === 'none' && cdsEndStat === 'none') {
    return {
      ...rest2,
      uniqueId,
      strand,
      type: 'transcript',
      refName,
      start,
      end,
      subfeatures: feats.map(e => ({ ...e, type: 'exon' })),
    }
  }

  // If exonFrames not available, calculate phases from CDS regions
  let calculatedPhases: Map<number, number> | undefined
  if (!exonFrames) {
    const cdsRegions: { start: number; end: number }[] = []
    for (const block of feats) {
      const { start, end } = block
      if (thickStart < end && thickEnd > start) {
        cdsRegions.push({
          start: Math.max(start, thickStart),
          end: Math.min(end, thickEnd),
        })
      }
    }
    calculatedPhases = calculatePhasesFromCds(cdsRegions, strand)
  }

  const subfeatures: MinimalFeature[] = []
  for (const [i, feat] of feats.entries()) {
    const { start, end } = feat

    if (thickStart >= end) {
      // entire block is 5' UTR
      subfeatures.push({ type: fiveUTR, start, end, refName })
    } else if (thickEnd <= start) {
      // entire block is 3' UTR
      subfeatures.push({ type: threeUTR, start, end, refName })
    } else {
      // block overlaps CDS region - may have UTR on either side
      if (start < thickStart) {
        subfeatures.push({ type: fiveUTR, start, end: thickStart, refName })
      }

      const cdsStart = Math.max(start, thickStart)
      const cdsEnd = Math.min(end, thickEnd)

      // Get phase from exonFrames (with conversion) or calculated phases
      let phase = 0
      if (exonFrames) {
        const frame = exonFrames[i]
        if (frame !== undefined && frame >= 0) {
          phase = frameToPhase(frame)
        }
      } else if (calculatedPhases) {
        phase = calculatedPhases.get(cdsStart) ?? 0
      }

      subfeatures.push({
        type: 'CDS',
        phase,
        start: cdsStart,
        end: cdsEnd,
        refName,
      })

      if (end > thickEnd) {
        subfeatures.push({ type: threeUTR, start: thickEnd, end, refName })
      }
    }
  }

  return {
    ...rest2,
    uniqueId,
    strand,
    type: 'mRNA',
    refName,
    start,
    end,
    subfeatures,
  }
}
