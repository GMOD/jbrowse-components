import SimpleFeature, { Feature } from '@jbrowse/core/util/simpleFeature'

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const newData: Record<string, any> = {}
  feature.tags().forEach(tag => {
    newData[tag] = feature.get(tag)
  })
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
