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

import type BED from '@gmod/bed'

function defaultParser(fields: string[], splitLine: string[]) {
  let hasBlockCount = false
  const r = [] as [string, string][]

  // eslint-disable-next-line unicorn/no-for-loop
  for (let i = 0; i < splitLine.length; i++) {
    if (fields[i] === 'blockCount') {
      hasBlockCount = true
    }
    r.push([fields[i]!, splitLine[i]!] as const)
  }
  // heuristically try to determine whether to follow 'slow path' as there can
  // be many features in e.g. GWAS type data
  const obj = Object.fromEntries(r)
  // slow path
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

  // fast path
  else {
    return obj
  }
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
  const starts = chromStarts || blockStarts || []
  for (let b = 0; b < blockCount; b++) {
    const bmin = (starts[b] || 0) + start
    const bsize = blockSizes?.[b]
    if (bsize && bsize > 0) {
      const bmax = bmin + bsize
      subfeatures.push({
        uniqueId: `${uniqueId}-${b}`,
        start: bmin,
        end: bmax,
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
}) {
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
  const strand =
    typeof strand2 === 'string' ? (strand2 === '-' ? -1 : 1) : strand2

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
      chromStarts,
      blockSizes,
      blockStarts,
      type,
      blockCount,
      thickStart,
      thickEnd,
      description,
      ...rest2
    } = rest
    return generateRepeatMaskerFeature({
      ...rest2,
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
}

export function arrayify(f?: string | number[]) {
  return f !== undefined
    ? typeof f === 'string'
      ? f.split(',').map(f => +f)
      : f
    : undefined
}
