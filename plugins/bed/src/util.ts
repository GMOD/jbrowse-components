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

export function generateUcscTranscript(feature: TranscriptFeat) {
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
  const feats = oldSubfeatures
    .filter(child => child.type === 'block')
    .sort((a, b) => a.start - b.start)

  for (const block of feats) {
    const start = block.start
    const end = block.end
    if (thickStart >= end) {
      // left-side UTR
      subfeatures.push({
        type: `${strand > 0 ? 'five' : 'three'}_prime_UTR`,
        start,
        end,
        refName,
      })
    } else if (thickStart > start && thickStart < end && thickEnd >= end) {
      // UTR | CDS
      subfeatures.push(
        {
          type: `${strand > 0 ? 'five' : 'three'}_prime_UTR`,
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
      subfeatures.push(
        {
          type: `${strand > 0 ? 'five' : 'three'}_prime_UTR`,
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
          type: `${strand > 0 ? 'three' : 'five'}_prime_UTR`,
          start: thickEnd,
          end,
          refName,
        },
      )
    } else if (thickStart <= start && thickEnd > start && thickEnd < end) {
      // CDS | UTR
      subfeatures.push(
        {
          type: 'CDS',
          start,
          end: thickEnd,
          refName,
        },
        {
          type: `${strand > 0 ? 'three' : 'five'}_prime_UTR`,
          start: thickEnd,
          end,
          refName,
        },
      )
    } else if (thickEnd <= start) {
      // right-side UTR
      subfeatures.push({
        type: `${strand > 0 ? 'three' : 'five'}_prime_UTR`,
        start,
        end,
        refName,
      })
    }
  }

  return {
    ...rest,
    strand,
    type: 'mRNA',
    refName,
    subfeatures,
  }
}
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

function generateBedMethylFeature({
  line,
  uniqueId,
  refName,
  start,
  end,
}: {
  line: string
  uniqueId: string
  refName: string
  start: number
  end: number
}) {
  // see
  // https://github.com/nanoporetech/modkit?tab=readme-ov-file#description-of-bedmethyl-output
  const [
    ,
    ,
    ,
    code,
    ,
    strand,
    ,
    ,
    color,
    n_valid_cov,
    fraction_modified,
    n_mod,
    n_canonical,
    n_other_mod,
    n_delete,
    n_fail,
    n_diff,
    n_nocall,
  ] = line.split('\t')
  return new SimpleFeature({
    id: uniqueId,
    data: {
      refName,
      start,
      end,
      code,
      score: fraction_modified,
      strand,
      color,
      source: code,
      n_valid_cov,
      fraction_modified,
      n_mod,
      n_canonical,
      n_other_mod,
      n_delete,
      n_fail,
      n_diff,
      n_nocall,
    },
  })
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

  const refName = splitLine[colRef]!
  const start = +splitLine[colStart]!
  const end = +splitLine[colEnd]! + (colStart === colEnd ? 1 : 0)
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
    return new SimpleFeature({
      id: uniqueId,
      data: {
        ...rest2,
        ...makeRepeatTrackDescription(description),
        refName,
        start,
        end,
        type,
        subfeatures,
      },
    })
  } else if (
    isUcscTranscript({
      strand,
      blockCount,
      thickStart,
      description,
    })
  ) {
    const {
      strand: strand2,
      score: score2,
      chrom: _1,
      chromStart: _2,
      chromEnd: _3,
      chromStarts,
      blockStarts,
      blockSizes,
      ...rest
    } = data
    return new SimpleFeature({
      id: uniqueId,
      data: generateUcscTranscript({
        ...rest,
        ...makeRepeatTrackDescription(description),
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
      }),
    })
  } else {
    return new SimpleFeature({
      id: uniqueId,
      data: {
        ...rest,
        ...makeRepeatTrackDescription(description),
        type,
        score,
        start,
        end,
        strand,
        refName,
        uniqueId,
        subfeatures,
      },
    })
  }
}

export function isUcscTranscript({
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

export function isBedMethylFeature({
  splitLine,
  start,
  end,
}: {
  splitLine: string[]
  start: number
  end: number
}) {
  return +(splitLine[6] || 0) === start && +(splitLine[7] || 0) === end
}

export function arrayify(f?: string | number[]) {
  return f !== undefined
    ? typeof f === 'string'
      ? f.split(',').map(f => +f)
      : f
    : undefined
}

function isRepeatMaskerDescriptionField(desc?: string): desc is string {
  const ret = desc?.trim().split(' ')
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
