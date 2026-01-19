import {
  generateBedMethylFeature,
  isBedMethylFeature,
} from './generateBedMethylFeature.ts'
import {
  generateRepeatMaskerFeature,
  isRepeatMaskerDescriptionField,
} from './generateRepeatMaskerFeature.ts'
import {
  generateUcscTranscript,
  isUcscTranscript,
} from './generateUcscTranscript.ts'

import type { MinimalFeature } from './types.ts'
import type BED from '@gmod/bed'

function defaultParser(fields: string[], splitLine: string[]) {
  const obj = {} as Record<string, string>
  let hasBlockCount = false

  for (const [i, element] of splitLine.entries()) {
    const field = fields[i]
    if (field) {
      obj[field] = element!
      if (field === 'blockCount') {
        hasBlockCount = true
      }
    }
  }

  // heuristically try to determine whether to follow 'slow path' as there can
  // be many features in e.g. GWAS type data
  if (hasBlockCount) {
    const {
      blockStarts,
      blockCount,
      chromStarts,
      thickEnd,
      thickStart,
      blockSizes,
      ...rest
    } = obj

    return {
      ...rest,
      blockStarts: arrayify(blockStarts),
      chromStarts: arrayify(chromStarts),
      blockSizes: arrayify(blockSizes),
      thickStart: thickStart ? +thickStart : undefined,
      thickEnd: thickEnd ? +thickEnd : undefined,
      blockCount: blockCount ? +blockCount : undefined,
    } as Record<string, unknown>
  }

  return obj
}

export function makeBlocks({
  start,
  uniqueId,
  refName,
  chromStarts,
  blockCount,
  blockSizes,
  blockStarts,
}: {
  blockCount: number
  start: number
  uniqueId: string
  refName: string
  chromStarts?: number[]
  blockSizes?: number[]
  blockStarts?: number[]
}) {
  const subfeatures = []
  const starts = chromStarts ?? blockStarts ?? []
  for (let b = 0; b < blockCount; b++) {
    const bmin = (starts[b] ?? 0) + start
    const bsize = blockSizes?.[b]
    if (bsize && bsize > 0) {
      subfeatures.push({
        uniqueId: `${uniqueId}-${b}`,
        start: bmin,
        end: bmin + bsize,
        refName,
        type: 'block',
      })
    }
  }
  return subfeatures
}

export function featureData({
  line,
  colRef,
  colStart,
  colEnd,
  scoreColumn,
  parser,
  uniqueId,
  names,
}: {
  line: string
  colRef: number
  colStart: number
  colEnd: number
  scoreColumn: string
  parser: BED
  uniqueId: string
  names?: string[]
}) {
  const splitLine = line.split('\t')
  const refName = splitLine[colRef]!
  const start = Number.parseInt(splitLine[colStart]!, 10)
  const end =
    Number.parseInt(splitLine[colEnd]!, 10) + (colStart === colEnd ? 1 : 0)

  return featureData2({
    splitLine,
    refName,
    start,
    end,
    parser,
    uniqueId,
    scoreColumn,
    names,
  })
}

function parseStrand(strand: unknown) {
  if (strand === '-' || strand === -1) {
    return -1
  }
  if (strand === '+' || strand === 1) {
    return 1
  }
  return 0
}

interface FeatureData {
  uniqueId: string
  refName: string
  start: number
  end: number
  strand?: number | string
  score?: number
  type?: string
  subfeatures?: MinimalFeature[]
  [key: string]: unknown
}

export function featureData2({
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
}): FeatureData {
  const data = names
    ? defaultParser(names, splitLine)
    : parser.parseLine(splitLine, { uniqueId })
  const {
    strand: strand2,
    score: score2,
    chrom: _1,
    chromStart: _2,
    chromEnd: _3,
    ...rest
  } = data

  const score = scoreColumn ? +data[scoreColumn] : score2 ? +score2 : undefined
  const strand = parseStrand(strand2)

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
  }

  if (isRepeatMaskerDescriptionField(rest.description)) {
    const {
      chromStarts: _4,
      blockSizes: _5,
      blockStarts: _6,
      blockCount: _7,
      thickStart: _8,
      thickEnd: _9,
      description,
      ...rest2
    } = rest
    return generateRepeatMaskerFeature({
      ...rest2,
      description,
      uniqueId,
      score,
      start,
      end,
      strand,
      refName,
      subfeatures,
    })
  }

  if (
    subfeatures &&
    isUcscTranscript({
      strand,
      blockCount: rest.blockCount,
      thickStart: rest.thickStart,
    })
  ) {
    return generateUcscTranscript({
      ...rest,
      score,
      start,
      end,
      strand,
      refName,
      uniqueId,
      subfeatures,
      thickStart: rest.thickStart as number,
      thickEnd: rest.thickEnd as number,
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

export function arrayify(f?: string | number[]) {
  if (f === undefined) {
    return undefined
  }
  if (typeof f === 'string') {
    return f.split(',').map(s => +s)
  }
  return f
}
