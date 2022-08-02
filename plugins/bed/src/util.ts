import { SimpleFeature, Feature } from '@jbrowse/core/util'
import BED from '@gmod/bed'

export function ucscProcessedTranscript(feature: Feature) {
  const children = feature.children()
  // split the blocks into UTR, CDS, and exons
  const thickStart = feature.get('thickStart')
  const thickEnd = feature.get('thickEnd')

  if (!thickStart && !thickEnd) {
    return feature
  }

  const blocks: Feature[] = children
    ? children
        .filter(child => child.get('type') === 'block')
        .sort((a, b) => a.get('start') - b.get('start'))
    : []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const newChildren: Record<string, any> = []
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
      })
    } else if (thickStart > start && thickStart < end && thickEnd >= end) {
      // UTR | CDS
      const prime = feature.get('strand') > 0 ? 'five' : 'three'
      newChildren.push(
        {
          type: `${prime}_prime_UTR`,
          start,
          end: thickStart,
        },
        {
          type: 'CDS',
          start: thickStart,
          end,
        },
      )
    } else if (thickStart <= start && thickEnd >= end) {
      // CDS
      newChildren.push({
        type: 'CDS',
        start,
        end,
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
        },
        {
          type: `CDS`,
          start: thickStart,
          end: thickEnd,
        },
        {
          type: `${rightPrime}_prime_UTR`,
          start: thickEnd,
          end,
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
        },
        {
          type: `${prime}_prime_UTR`,
          start: thickEnd,
          end,
        },
      )
    } else if (thickEnd <= start) {
      // right-side UTR
      const prime = feature.get('strand') > 0 ? 'three' : 'five'
      newChildren.push({
        type: `${prime}_prime_UTR`,
        start,
        end,
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
  const newFeature = new SimpleFeature({
    data: newData,
    id: feature.id(),
  })
  return newFeature
}

function defaultParser(fields: string[], line: string) {
  return Object.fromEntries(line.split('\t').map((f, i) => [fields[i], f]))
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

  const { blockCount, blockSizes, blockStarts, chromStarts } = data

  if (blockCount) {
    const starts = chromStarts || blockStarts || []
    const sizes = blockSizes
    const blocksOffset = start
    data.subfeatures = []

    for (let b = 0; b < blockCount; b += 1) {
      const bmin = (starts[b] || 0) + blocksOffset
      const bmax = bmin + (sizes[b] || 0)
      data.subfeatures.push({
        uniqueId: `${uniqueId}-${b}`,
        start: bmin,
        end: bmax,
        type: 'block',
      })
    }
  }

  if (scoreColumn) {
    data.score = +data[scoreColumn]
  }
  delete data.chrom
  delete data.chromStart
  delete data.chromEnd
  const f = new SimpleFeature({
    ...data,
    start,
    end,
    refName,
    uniqueId,
  })
  return f.get('thickStart') ? ucscProcessedTranscript(f) : f
}
