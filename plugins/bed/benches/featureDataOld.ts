// featureData and the helpers it changed with, as they stood before the
// copyExcept change, for featureData.bench.ts. featureDataControl.ts is the
// same file byte for byte.
import { generateBedMethylFeature } from '../src/generateBedMethylFeature.ts'
import {
  generateRastairMethylFeature,
  isRastairMethylFeature,
} from '../src/generateRastairMethylFeature.ts'
import { isUcscTranscript } from '../src/generateUcscTranscript.ts'
import { makeBlocks, parseStrand } from '../src/util.ts'

import type { MinimalFeature } from '../src/types.ts'
import type { FeatureData } from '../src/util.ts'
import type BED from '@gmod/bed'

// this uses modkit bedMethyl. unclear how to reliably detect minimal 9+2 bedMethyl
export function isBedMethylFeature({
  splitLine,
  start,
  end,
}: {
  splitLine: string[]
  start: number
  end: number
}) {
  // columns 9-17 are the nine numeric methylation stats
  const nums = splitLine.slice(9, 18)
  return (
    splitLine[6] !== undefined &&
    +splitLine[6] === start &&
    splitLine[7] !== undefined &&
    +splitLine[7] === end &&
    nums.length === 9 &&
    nums.every(x => x && !Number.isNaN(+x))
  )
}

const FIELDS = [
  'bitsw_score',
  'percent_div',
  'percent_del',
  'percent_ins',
  'query_chr',
  'query_begin',
  'query_end',
  'query_remaining',
  'orientation',
  'matching_repeat_name',
  'matching_repeat_class',
  'matching_repeat_begin',
  'matching_repeat_end',
  'matching_repeat_remaining',
  'repeat_id',
] as const

export type RepeatMaskerFields = Record<(typeof FIELDS)[number], string>

// RepeatMasker .out-derived description: 15 space-separated fields with numeric
// values at positions 0,1,2,3,5,6. Returns parsed fields or undefined if the
// description doesn't match the format.
export function parseRepeatMaskerDescription(
  desc: unknown,
): RepeatMaskerFields | undefined {
  if (typeof desc === 'string') {
    const parts = desc.trim().split(' ')
    const looksRight = [0, 1, 2, 3, 5, 6].every(
      i => parts[i] !== undefined && !Number.isNaN(+parts[i]),
    )
    if (looksRight) {
      return Object.fromEntries(
        FIELDS.map((f, i) => [f, parts[i] ?? '']),
      ) as RepeatMaskerFields
    }
  }
  return undefined
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

function parseFrames(frames: unknown) {
  return typeof frames === 'string'
    ? frames.replace(/,$/, '').split(',').map(Number)
    : (frames as number[] | undefined)
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
  // _exonFrames fallback supports BED files that use the underscore-prefixed column
  // name, which the parser leaves as raw text because it is not a standard column.
  const exonFrames = parseFrames(rest.exonFrames ?? rest._exonFrames)

  const feats = oldSubfeatures
    .filter(child => child.type === 'block')
    .sort((a, b) => a.start - b.start)

  const fiveUTR = strand > 0 ? 'five_prime_UTR' : 'three_prime_UTR'
  const threeUTR = strand > 0 ? 'three_prime_UTR' : 'five_prime_UTR'

  // thickStart===thickEnd is UCSC for no coding region, and the block walk
  // below cannot express that: a thick point inside a block would emit a
  // zero-length CDS carrying a phase, and one outside every block would make
  // the whole transcript UTR.
  //
  // cdsStartStat and cdsEndStat `none` alone do not mean non-coding: UCSC's
  // GENCODE bigGenePred (gencodeV44.bb through V50) writes `none` on every
  // transcript, and reading it as non-coding stripped the CDS from all 370,886
  // of V50's coding ones, TP53 included. exonFrames tells them apart there:
  // every coding transcript has a block with a frame, every other one has -1
  // throughout.
  const { cdsEndStat, cdsStartStat } = rest
  if (
    thickStart === thickEnd ||
    (cdsStartStat === 'none' &&
      cdsEndStat === 'none' &&
      !exonFrames?.some(frame => frame >= 0))
  ) {
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

interface BedData {
  strand?: string | number
  score?: string | number
  chrom?: string
  chromStart?: number | string
  chromEnd?: number | string
  description?: string
  blockCount?: number
  chromStarts?: number[]
  blockSizes?: number[]
  blockStarts?: number[]
  thickStart?: number
  thickEnd?: number
  [key: string]: unknown
}

export function featureData({
  splitLine,
  refName,
  start,
  end,
  parser,
  uniqueId,
  scoreColumn,
  names,
  disableGeneHeuristic,
}: {
  splitLine: string[]
  refName: string
  start: number
  end: number
  parser: BED
  uniqueId: string
  scoreColumn: string
  // only for the dialects identified by their header, not for parsing: the
  // parser already carries the column names (see makeParser)
  names?: string[]
  disableGeneHeuristic?: boolean
}): FeatureData {
  // bedMethyl detection runs on raw splitLine before parsing
  if (isBedMethylFeature({ splitLine, start, end })) {
    return generateBedMethylFeature({
      splitLine,
      uniqueId,
      refName,
      start,
      end,
    })
  }

  // rastair methylation is identified by its header column names
  if (names !== undefined && isRastairMethylFeature(names)) {
    return generateRastairMethylFeature({
      splitLine,
      names,
      uniqueId,
      refName,
      start,
      end,
    })
  }

  const data: BedData = parser.parseLine(splitLine, { uniqueId })
  const {
    strand: strandRaw,
    score: scoreRaw,
    chrom,
    chromStart,
    chromEnd,
    ...rest
  } = data
  const strand = parseStrand(strandRaw)
  const rawScore = scoreColumn ? data[scoreColumn] : scoreRaw
  const score = rawScore === undefined ? undefined : Number(rawScore)

  const repeat = parseRepeatMaskerDescription(rest.description)
  if (repeat) {
    const {
      description,
      chromStarts,
      blockSizes,
      blockStarts,
      blockCount,
      thickStart,
      thickEnd,
      ...rest2
    } = rest
    return {
      ...rest2,
      ...repeat,
      uniqueId,
      score,
      start,
      end,
      strand,
      refName,
    }
  }

  const subfeatures = rest.blockCount
    ? makeBlocks({
        start,
        uniqueId,
        refName,
        chromStarts: rest.chromStarts,
        blockCount: rest.blockCount,
        blockSizes: rest.blockSizes,
        blockStarts: rest.blockStarts,
      })
    : undefined

  const transcriptCheck = {
    strand,
    blockCount: rest.blockCount,
    thickStart: rest.thickStart,
    thickEnd: rest.thickEnd,
  }
  if (
    !disableGeneHeuristic &&
    subfeatures &&
    isUcscTranscript(transcriptCheck)
  ) {
    return generateUcscTranscript({
      ...rest,
      score,
      start,
      end,
      strand: transcriptCheck.strand,
      refName,
      uniqueId,
      subfeatures,
      thickStart: transcriptCheck.thickStart,
      thickEnd: transcriptCheck.thickEnd,
    })
  }
  return {
    ...rest,
    uniqueId,
    score,
    start,
    end,
    strand,
    refName,
    subfeatures,
  }
}
