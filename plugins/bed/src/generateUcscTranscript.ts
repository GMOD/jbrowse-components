import type { MinimalFeature, TranscriptFeat } from './types'

export function isUcscTranscript({
  thickStart,
  blockCount,
  strand,
}: {
  thickStart?: number
  blockCount?: number
  strand?: number
}) {
  return thickStart && blockCount && strand !== 0
}

export function generateUcscTranscript(data: TranscriptFeat) {
  const {
    strand = 0,
    chrom: _1,
    chromStart: _2,
    chromEnd: _3,
    chromStarts,
    blockStarts,
    blockSizes,
    uniqueId,
    ...rest
  } = data
  const {
    subfeatures: oldSubfeatures,
    thickStart,
    thickEnd,
    blockCount,
    refName,
    ...rest2
  } = rest

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
    ...rest2,
    uniqueId,
    strand,
    type: 'mRNA',
    refName,
    subfeatures,
  }
}
