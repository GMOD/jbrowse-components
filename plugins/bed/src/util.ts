import BED from '@gmod/bed'
import { SimpleFeature } from '@jbrowse/core/util'

export interface MinimalFeature {
  type: string
  start: number
  end: number
  refName: string
  [key: string]: unknown
}
export interface TranscriptFeat extends MinimalFeature {
  thickStart: number
  thickEnd: number
  blockCount: number
  blockSizes: number[]
  chromStarts: number[]
  refName: string
  strand?: number
  subfeatures: MinimalFeature[]
}

export function ucscProcessedTranscript(feature: TranscriptFeat) {
  const {
    subfeatures: oldSubfeatures,
    thickStart,
    thickEnd,
    blockCount,
    blockSizes,
    chromStarts,
    refName,
    strand = 0,
    ...rest
  } = feature

  if (!thickStart || !thickEnd || !strand) {
    return feature
  }

  const subfeatures: MinimalFeature[] = []
  oldSubfeatures
    .filter(child => child.type === 'block')
    .sort((a, b) => a.start - b.start)
    .forEach(block => {
      const start = block.start
      const end = block.end
      if (thickStart >= end) {
        // left-side UTR
        const prime = strand > 0 ? 'five' : 'three'
        subfeatures.push({
          type: `${prime}_prime_UTR`,
          start,
          end,
          refName,
        })
      } else if (thickStart > start && thickStart < end && thickEnd >= end) {
        // UTR | CDS
        const prime = strand > 0 ? 'five' : 'three'
        subfeatures.push(
          {
            type: `${prime}_prime_UTR`,
            start,
            end: thickStart,
            refName,
          },
          {
            type: 'CDS',
            start: thickStart,
            end,
            refName,
          },
        )
      } else if (thickStart <= start && thickEnd >= end) {
        // CDS
        subfeatures.push({
          type: 'CDS',
          start,
          end,
          refName,
        })
      } else if (thickStart > start && thickStart < end && thickEnd < end) {
        // UTR | CDS | UTR
        const leftPrime = strand > 0 ? 'five' : 'three'
        const rightPrime = strand > 0 ? 'three' : 'five'
        subfeatures.push(
          {
            type: `${leftPrime}_prime_UTR`,
            start,
            end: thickStart,
            refName,
          },
          {
            type: 'CDS',
            start: thickStart,
            end: thickEnd,
            refName,
          },
          {
            type: `${rightPrime}_prime_UTR`,
            start: thickEnd,
            end,
            refName,
          },
        )
      } else if (thickStart <= start && thickEnd > start && thickEnd < end) {
        // CDS | UTR
        const prime = strand > 0 ? 'three' : 'five'
        subfeatures.push(
          {
            type: 'CDS',
            start,
            end: thickEnd,
            refName,
          },
          {
            type: `${prime}_prime_UTR`,
            start: thickEnd,
            end,
            refName,
          },
        )
      } else if (thickEnd <= start) {
        // right-side UTR
        const prime = strand > 0 ? 'three' : 'five'
        subfeatures.push({
          type: `${prime}_prime_UTR`,
          start,
          end,
          refName,
        })
      }
    })

  return { ...rest, strand, type: 'mRNA', refName, subfeatures }
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
export function featureData(
  line: string,
  colRef: number,
  colStart: number,
  colEnd: number,
  scoreColumn: string,
  parser: BED,
  uniqueId: string,
  names?: string[],
) {
  const l = line.split('\t')
  const data = names
    ? defaultParser(names, line)
    : parser.parseLine(line, { uniqueId })

  const {
    blockCount,
    blockSizes,
    blockStarts,
    chromStarts,
    thickStart,
    thickEnd,
    type,
    description,
    strand: strand2,
    score: score2,
    chrom: _1,
    chromStart: _2,
    chromEnd: _3,
    ...rest
  } = data

  const refName = l[colRef]!
  const start = +l[colStart]!
  const colSame = colStart === colEnd ? 1 : 0
  const end = +l[colEnd]! + colSame
  const score = scoreColumn ? +data[scoreColumn] : +score2
  const strand =
    typeof strand2 === 'string'
      ? strand2 === '-'
        ? -1
        : strand2 === '+'
          ? 1
          : 0
      : strand2

  const f = {
    ...rest,
    ...makeRepeatTrackDescription(description),
    type,
    score,
    start,
    end,
    strand,
    refName,
    uniqueId,
    subfeatures: makeBlocks({
      start,
      uniqueId,
      refName,
      chromStarts,
      blockCount,
      blockSizes,
      blockStarts,
    }),
  }
  return new SimpleFeature({
    id: uniqueId,
    data: isUcscProcessedTranscript({
      strand,
      blockCount,
      thickStart,
      description,
    })
      ? ucscProcessedTranscript({
          thickStart: thickStart!,
          thickEnd: thickEnd!,
          blockCount: blockCount!,
          blockSizes: blockSizes!,
          chromStarts: chromStarts,
          ...f,
        })
      : f,
  })
}

export function isUcscProcessedTranscript({
  thickStart,
  blockCount,
  strand,
  description,
}: {
  thickStart?: number
  blockCount?: number
  strand?: number
  description?: string
}) {
  return (
    thickStart &&
    blockCount &&
    strand !== 0 &&
    !isRepeatMaskerDescriptionField(description)
  )
}

export function arrayify(f?: string | number[]) {
  return f !== undefined
    ? typeof f === 'string'
      ? f.split(',').map(f => +f)
      : f
    : undefined
}

function isRepeatMaskerDescriptionField(
  description?: string,
): description is string {
  const ret = description?.trim().split(' ')
  return [0, 1, 2, 3, 5, 6].every(s =>
    ret?.[s] !== undefined ? !Number.isNaN(+ret[s]) : false,
  )
}
export function makeRepeatTrackDescription(description?: string) {
  if (isRepeatMaskerDescriptionField(description)) {
    const [
      bitsw_score,
      percent_div,
      percent_del,
      percent_ins,
      query_chr,
      query_begin,
      query_end,
      query_remaining,
      orientation,
      matching_repeat_name,
      matching_repeat_class,
      matching_repeat_begin,
      matching_repeat_end,
      matching_repeat_remaining,
      repeat_id,
    ] = description.trim().split(' ')
    return {
      bitsw_score,
      percent_div,
      percent_del,
      percent_ins,
      query_chr,
      query_begin,
      query_end,
      query_remaining,
      orientation,
      matching_repeat_name,
      matching_repeat_class,
      matching_repeat_begin,
      matching_repeat_end,
      matching_repeat_remaining,
      repeat_id,
    }
  }
  return { description }
}
