import {
  generateBedMethylFeature,
  isBedMethylFeature,
} from './generateBedMethylFeature'
import {
  generateRepeatMaskerFeature,
  isRepeatMaskerDescriptionField,
} from './generateRepeatMaskerFeature'
import {
  generateUcscTranscript,
  isUcscTranscript,
} from './generateUcscTranscript'
import { defaultParser, makeBlocks } from './util'

import type BED from '@gmod/bed'

function normalizeStrand(
  rawStrand: string | number | undefined,
): number | undefined {
  return typeof rawStrand === 'string'
    ? rawStrand === '-'
      ? -1
      : 1
    : rawStrand
}

function createBaseFeatureData({
  rest,
  uniqueId,
  score,
  start,
  end,
  strand,
  refName,
  subfeatures,
}: {
  rest: Record<string, unknown>
  uniqueId: string
  score: number | undefined
  start: number
  end: number
  strand: number | undefined
  refName: string
  subfeatures:
    | {
        uniqueId: string
        start: number
        end: number
        refName: string
        type: string
      }[]
    | undefined
}) {
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

export function generateFeature({
  splitLine,
  refName,
  start,
  end,
  parser,
  uniqueId,
  scoreColumn,
  names,
}: {
  splitLine: string[]
  refName: string
  start: number
  end: number
  parser: BED
  uniqueId: string
  scoreColumn: string
  names?: string[]
}) {
  const data = names
    ? defaultParser(names, splitLine)
    : parser.parseLine(splitLine, { uniqueId })
  const {
    strand: rawStrand,
    score: rawScore,
    chrom: _unusedChrom,
    chromStart: _unusedChromStart,
    chromEnd: _unusedChromEnd,
    ...rest
  } = data

  const score = scoreColumn
    ? +data[scoreColumn]
    : rawScore
      ? +rawScore
      : undefined
  const strand = normalizeStrand(rawStrand)

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

  if (isBedMethylFeature({ splitLine, start, end })) {
    return generateBedMethylFeature({
      splitLine,
      uniqueId,
      refName,
      start,
      end,
    })
  } else if (isRepeatMaskerDescriptionField(rest.description)) {
    const {
      chromStarts: _unusedChromStarts,
      blockSizes: _unusedBlockSizes,
      blockStarts: _unusedBlockStarts,
      type,
      blockCount: _unusedBlockCount,
      thickStart: _unusedThickStart,
      thickEnd: _unusedThickEnd,
      description,
      ...restForRepeatMasker
    } = rest
    return generateRepeatMaskerFeature({
      ...restForRepeatMasker,
      uniqueId,
      description,
      type,
      score,
      start,
      end,
      strand,
      refName,
      subfeatures,
    })
  } else if (
    subfeatures &&
    isUcscTranscript({
      strand,
      blockCount: rest.blockCount,
      thickStart: rest.thickStart,
    })
  ) {
    const {
      chromStarts,
      blockSizes,
      type,
      blockCount,
      thickStart,
      thickEnd,
      description,
    } = rest
    return generateUcscTranscript({
      ...rest,
      description,
      chromStarts,
      thickStart,
      thickEnd,
      blockSizes,
      blockCount,
      type,
      score,
      start,
      end,
      strand,
      refName,
      uniqueId,
      subfeatures,
    })
  } else {
    return createBaseFeatureData({
      rest,
      uniqueId,
      score,
      start,
      end,
      strand,
      refName,
      subfeatures,
    })
  }
}
