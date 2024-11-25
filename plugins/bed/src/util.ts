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
import type { SimpleFeatureSerialized } from '@jbrowse/core/util'

function stringToStrand(f: string) {
  if (f === '-1') {
    return -1
  } else if (f === '+') {
    return 1
  } else {
    return 0
  }
}

function defaultParser(fields: string[], line: string) {
  const obj = Object.fromEntries(
    line.split('\t').map((f, i) => [fields[i]!, f] as const),
  )
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
  if (blockCount) {
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
  return []
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
  const start = +splitLine[colStart]!
  const end = +splitLine[colEnd]! + (colStart === colEnd ? 1 : 0)

  return featureData2({
    line,
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
  line,
  refName,
  start,
  end,
  parser,
  uniqueId,
  scoreColumn,
  names,
}: {
  line: string
  refName: string
  start: number
  end: number
  parser: BED
  uniqueId: string
  scoreColumn: string
  names?: string[]
}): SimpleFeatureSerialized {
  const splitLine = line.split('\t')
  const data = names
    ? defaultParser(names, line)
    : parser.parseLine(line, { uniqueId })
  const {
    strand: strand2,
    score: score2,
    chrom: _1,
    chromStart: _2,
    chromEnd: _3,
    ...rest
  } = data

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
  const score = scoreColumn ? +data[scoreColumn] : score2 ? +score2 : undefined
  const strand = typeof strand2 === 'string' ? stringToStrand(strand2) : strand2

  const subfeatures = makeBlocks({
    start,
    uniqueId,
    refName,
    chromStarts,
    blockCount,
    blockSizes,
    blockStarts,
  })

  if (isBedMethylFeature({ splitLine, start, end })) {
    return generateBedMethylFeature({
      line,
      uniqueId,
      refName,
      start,
      end,
    })
  } else if (isRepeatMaskerDescriptionField(description)) {
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
  } else if (isUcscTranscript({ strand, blockCount, thickStart })) {
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
      description,
      type,
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
