import BED from '@gmod/bed'
import { SimpleFeature } from '@jbrowse/core/util'

interface MinimalFeature {
  type: string
  start: number
  end: number
  refName: string
}
interface TranscriptFeat {
  thickStart: number
  thickEnd: number
  blockCount: number
  blockSizes: number[]
  chromStarts: number[]
  refName: string
  strand?: number
  subfeatures: MinimalFeature[]
  [key: string]: unknown
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
    ?.forEach(block => {
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
            type: `CDS`,
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
            type: `CDS`,
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
  const {
    blockStarts,
    blockCount,
    chromStarts,
    thickEnd,
    thickStart,
    blockSizes,
    ...rest
  } = Object.fromEntries(line.split('\t').map((f, i) => [fields[i], f]))

  return {
    ...rest,
    blockStarts: blockStarts?.split(',').map(r => +r),
    chromStarts: chromStarts?.split(',').map(r => +r),
    blockSizes: blockSizes?.split(',').map(r => +r),
    thickStart: +thickStart,
    thickEnd: +thickEnd,
    blockCount: +blockCount,
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
  chromStarts: number[]
  blockSizes: number[]
  blockStarts: number[]
}) {
  const subfeatures = []
  const starts = chromStarts || blockStarts || []
  for (let b = 0; b < blockCount; b++) {
    const bmin = (starts[b] || 0) + start
    const bmax = bmin + (blockSizes?.[b] || 0)
    subfeatures.push({
      uniqueId: `${uniqueId}-${b}`,
      start: bmin,
      end: bmax,
      refName,
      type: 'block',
    })
  }
  return subfeatures
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
  const refName = l[colRef]
  const start = +l[colStart]
  const colSame = colStart === colEnd ? 1 : 0
  const end = +l[colEnd] + colSame
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
    score,
    chrom: _1,
    chromStart: _2,
    chromEnd: _3,
    ...rest
  } = data
  const subfeatures = blockCount
    ? makeBlocks({
        start,
        uniqueId,
        refName,
        chromStarts,
        blockCount,
        blockSizes,
        blockStarts,
      })
    : []
  const f = {
    ...rest,
    type,
    score: scoreColumn ? +data[scoreColumn] : score,
    start,
    end,
    refName,
    uniqueId,
    subfeatures,
  }
  return new SimpleFeature({
    id: uniqueId,
    data: isUCSC(data)
      ? ucscProcessedTranscript({
          thickStart,
          thickEnd,
          blockCount,
          blockSizes,
          chromStarts,
          ...f,
        })
      : f,
  })
}

export function isUCSC(f: {
  thickStart?: number
  blockCount?: number
  strand?: number
}) {
  return f.thickStart && f.blockCount && f.strand !== 0
}
