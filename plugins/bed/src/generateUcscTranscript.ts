import type { MinimalFeature, TranscriptFeat } from './types'

const CDS_STAT_NONE = 'none' as const
const NEUTRAL_STRAND = 0 as const

export function isUcscTranscript({
  thickStart,
  blockCount,
  strand,
}: {
  thickStart?: number
  blockCount?: number
  strand?: number
}) {
  return Boolean(thickStart && blockCount && strand !== NEUTRAL_STRAND)
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

  const { cdsEndStat, cdsStartStat } = rest2
  const hasNoCodingSequence =
    cdsStartStat === CDS_STAT_NONE && cdsEndStat === CDS_STAT_NONE

  if (hasNoCodingSequence) {
    return {
      ...rest2,
      uniqueId,
      strand,
      type: 'transcript',
      refName,
      subfeatures: feats.map(feature => ({
        ...feature,
        type: 'exon',
      })),
    }
  } else {
    for (const block of feats) {
      const blockStart = block.start
      const blockEnd = block.end

      if (thickStart >= blockEnd) {
        // left-side UTR
        subfeatures.push({
          type: `${strand > 0 ? 'five' : 'three'}_prime_UTR`,
          start: blockStart,
          end: blockEnd,
          refName,
        })
      } else if (
        thickStart > blockStart &&
        thickStart < blockEnd &&
        thickEnd >= blockEnd
      ) {
        // UTR | CDS
        subfeatures.push(
          {
            type: `${strand > 0 ? 'five' : 'three'}_prime_UTR`,
            start: blockStart,
            end: thickStart,
            refName,
          },
          {
            type: 'CDS',
            phase: 0,
            start: thickStart,
            end: blockEnd,
            refName,
          },
        )
      } else if (thickStart <= blockStart && thickEnd >= blockEnd) {
        // CDS
        subfeatures.push({
          type: 'CDS',
          phase: 0,
          start: blockStart,
          end: blockEnd,
          refName,
        })
      } else if (
        thickStart > blockStart &&
        thickStart < blockEnd &&
        thickEnd < blockEnd
      ) {
        // UTR | CDS | UTR
        subfeatures.push(
          {
            type: `${strand > 0 ? 'five' : 'three'}_prime_UTR`,
            start: blockStart,
            end: thickStart,
            refName,
          },
          {
            type: 'CDS',
            phase: 0,
            start: thickStart,
            end: thickEnd,
            refName,
          },
          {
            type: `${strand > 0 ? 'three' : 'five'}_prime_UTR`,
            start: thickEnd,
            end: blockEnd,
            refName,
          },
        )
      } else if (
        thickStart <= blockStart &&
        thickEnd > blockStart &&
        thickEnd < blockEnd
      ) {
        // CDS | UTR
        subfeatures.push(
          {
            type: 'CDS',
            phase: 0,
            start: blockStart,
            end: thickEnd,
            refName,
          },
          {
            type: `${strand > 0 ? 'three' : 'five'}_prime_UTR`,
            start: thickEnd,
            end: blockEnd,
            refName,
          },
        )
      } else if (thickEnd <= blockStart) {
        // right-side UTR
        subfeatures.push({
          type: `${strand > 0 ? 'three' : 'five'}_prime_UTR`,
          start: blockStart,
          end: blockEnd,
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

  return {
    ...rest2,
    uniqueId,
    strand,
    type: 'mRNA',
    refName,
    subfeatures,
  }
}
