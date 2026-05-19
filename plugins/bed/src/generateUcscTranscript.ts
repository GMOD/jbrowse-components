import type { MinimalFeature } from './types.ts'

interface UcscTranscriptCheck {
  thickStart?: number
  thickEnd?: number
  blockCount?: number
  strand?: number
}

interface ValidUcscTranscriptCheck {
  thickStart: number
  thickEnd: number
  blockCount: number
  strand: number
}

// type guard: narrows input fields to required + non-zero when true
// strand===0 means unstranded — likely not a gene
export function isUcscTranscript(
  input: UcscTranscriptCheck,
): input is ValidUcscTranscriptCheck {
  return (
    input.thickStart !== undefined &&
    input.thickEnd !== undefined &&
    input.thickStart !== input.thickEnd &&
    input.blockCount !== undefined &&
    input.blockCount > 0 &&
    input.strand !== undefined &&
    input.strand !== 0
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
    phaseMap.set(cds.start, (3 - (cumulativeWidth % 3)) % 3)
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
  strand: number
  thickStart: number
  thickEnd: number
  refName: string
  start: number
  end: number
  subfeatures: MinimalFeature[]
  [key: string]: unknown
}

interface UcscTranscriptOutput extends MinimalFeature {
  uniqueId: string
  strand: number
  type: 'mRNA' | 'transcript'
  refName: string
  start: number
  end: number
  subfeatures: MinimalFeature[]
  [key: string]: unknown
}

export function generateUcscTranscript(
  data: UcscTranscriptInput,
): UcscTranscriptOutput {
  const {
    strand,
    uniqueId,
    start,
    end,
    thickStart,
    thickEnd,
    refName,
    subfeatures: oldSubfeatures,
    chrom,
    chromStart,
    chromEnd,
    chromStarts,
    blockStarts,
    blockSizes,
    blockCount,
    ...rest
  } = data

  // exonFrames from bigGenePred - the @gmod/bed parser returns it in genomic order.
  // _exonFrames fallback supports BED files that use the underscore-prefixed column name.
  const exonFrames = (rest.exonFrames ?? rest._exonFrames) as
    | number[]
    | undefined

  const feats = oldSubfeatures
    .filter(child => child.type === 'block')
    .sort((a, b) => a.start - b.start)

  const fiveUTR = strand > 0 ? 'five_prime_UTR' : 'three_prime_UTR'
  const threeUTR = strand > 0 ? 'three_prime_UTR' : 'five_prime_UTR'

  const { cdsEndStat, cdsStartStat } = rest
  if (cdsStartStat === 'none' && cdsEndStat === 'none') {
    return {
      ...rest,
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
      if (thickStart < block.end && thickEnd > block.start) {
        cdsRegions.push({
          start: Math.max(block.start, thickStart),
          end: Math.min(block.end, thickEnd),
        })
      }
    }
    calculatedPhases = calculatePhasesFromCds(cdsRegions, strand)
  }

  const subfeatures: MinimalFeature[] = []
  for (const [i, feat] of feats.entries()) {
    const { start: bStart, end: bEnd } = feat

    if (thickStart >= bEnd) {
      // entire block is 5' UTR
      subfeatures.push({ type: fiveUTR, start: bStart, end: bEnd, refName })
    } else if (thickEnd <= bStart) {
      // entire block is 3' UTR
      subfeatures.push({ type: threeUTR, start: bStart, end: bEnd, refName })
    } else {
      // block overlaps CDS region - may have UTR on either side
      if (bStart < thickStart) {
        subfeatures.push({
          type: fiveUTR,
          start: bStart,
          end: thickStart,
          refName,
        })
      }

      const cdsStart = Math.max(bStart, thickStart)
      const cdsEnd = Math.min(bEnd, thickEnd)

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

      if (bEnd > thickEnd) {
        subfeatures.push({
          type: threeUTR,
          start: thickEnd,
          end: bEnd,
          refName,
        })
      }
    }
  }

  return {
    ...rest,
    uniqueId,
    strand,
    type: 'mRNA',
    refName,
    start,
    end,
    subfeatures,
  }
}
