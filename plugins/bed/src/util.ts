import { SimpleFeature, Feature } from '@jbrowse/core/util'
import BED from '@gmod/bed'

interface MinimalFeature {
  type: string
  start: number
  end: number
  refName: string
}

export function ucscProcessedTranscript(feature: Feature) {
  const children = feature.children()
  // split the blocks into UTR, CDS, and exons
  const thickStart = feature.get('thickStart')
  const thickEnd = feature.get('thickEnd')
  const refName = feature.get('refName')

  if (!thickStart && !thickEnd) {
    return feature
  }

  const blocks: Feature[] = children
    ? children
        .filter(child => child.get('type') === 'block')
        .sort((a, b) => a.get('start') - b.get('start'))
    : []

  const newChildren: MinimalFeature[] = []
  blocks.forEach(block => {
    const start = block.get('start')
    const end = block.get('end')
    if (thickStart >= end) {
      // left-side UTR
      const prime = feature.get('strand') > 0 ? 'five' : 'three'
      newChildren.push({
        type: `${prime}_prime_UTR`,
        start,
        end,
        refName,
      })
    } else if (thickStart > start && thickStart < end && thickEnd >= end) {
      // UTR | CDS
      const prime = feature.get('strand') > 0 ? 'five' : 'three'
      newChildren.push(
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
      newChildren.push({
        type: 'CDS',
        start,
        end,
        refName,
      })
    } else if (thickStart > start && thickStart < end && thickEnd < end) {
      // UTR | CDS | UTR
      const leftPrime = feature.get('strand') > 0 ? 'five' : 'three'
      const rightPrime = feature.get('strand') > 0 ? 'three' : 'five'
      newChildren.push(
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
      const prime = feature.get('strand') > 0 ? 'three' : 'five'
      newChildren.push(
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
      const prime = feature.get('strand') > 0 ? 'three' : 'five'
      newChildren.push({
        type: `${prime}_prime_UTR`,
        start,
        end,
        refName,
      })
    }
  })
  const newData = Object.fromEntries(
    feature.tags().map(tag => [tag, feature.get(tag)]),
  )
  newData.subfeatures = newChildren
  newData.type = 'mRNA'
  newData.uniqueId = feature.id()
  delete newData.chromStarts
  delete newData.chromStart
  delete newData.chromEnd
  delete newData.chrom
  delete newData.blockStarts
  delete newData.blockSizes
  delete newData.blockCount
  delete newData.thickStart
  delete newData.thickEnd
  return new SimpleFeature({
    data: newData,
    id: feature.id(),
  })
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
  const subfeatures = []
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
    score,
    chrom: _1,
    chromStart: _2,
    chromEnd: _3,
    ...rest
  } = data

  if (blockCount) {
    const starts = chromStarts || blockStarts || []
    const blocksOffset = start

    for (let b = 0; b < blockCount; b += 1) {
      const bmin = (starts[b] || 0) + blocksOffset
      const bmax = bmin + (blockSizes[b] || 0)
      subfeatures.push({
        uniqueId: `${uniqueId}-${b}`,
        start: bmin,
        end: bmax,
        refName,
        type: 'block',
      })
    }
  }

  const f = new SimpleFeature({
    ...rest,
    score: scoreColumn ? +data[scoreColumn] : score,
    start,
    end,
    refName,
    uniqueId,
    subfeatures,
  })
  return thickStart ? ucscProcessedTranscript(f) : f
}
