import { type Feature, SimpleFeature } from '@jbrowse/core/util'

import { isUTR } from './util'

export function makeUTRs(parent: Feature, subs: Feature[]) {
  // based on Lincoln's UTR-making code in
  // Bio::Graphics::Glyph::processed_transcript
  const subparts = [...subs]

  let codeStart = Number.POSITIVE_INFINITY
  let codeEnd = Number.NEGATIVE_INFINITY

  let haveLeftUTR: boolean | undefined
  let haveRightUTR: boolean | undefined

  // gather exons, find coding start and end, and look for UTRs
  const exons = []
  for (const subpart of subparts) {
    const type = subpart.get('type')
    if (/^cds/i.test(type)) {
      if (codeStart > subpart.get('start')) {
        codeStart = subpart.get('start')
      }
      if (codeEnd < subpart.get('end')) {
        codeEnd = subpart.get('end')
      }
    } else if (/exon/i.test(type)) {
      exons.push(subpart)
    } else if (isUTR(subpart)) {
      haveLeftUTR = subpart.get('start') === parent.get('start')
      haveRightUTR = subpart.get('end') === parent.get('end')
    }
  }

  // bail if we don't have exons and CDS
  if (
    !(
      exons.length &&
      codeStart < Number.POSITIVE_INFINITY &&
      codeEnd > Number.NEGATIVE_INFINITY
    )
  ) {
    return subparts
  }

  // make sure the exons are sorted by coord
  exons.sort((a, b) => a.get('start') - b.get('start'))

  const strand = parent.get('strand')

  // make the left-hand UTRs
  let start: number | undefined
  let end: number | undefined
  if (!haveLeftUTR) {
    for (const [i, exon] of exons.entries()) {
      start = exon.get('start')
      if (start >= codeStart) {
        break
      }
      end = Math.min(codeStart, exon.get('end'))
      const type = strand >= 0 ? 'five_prime_UTR' : 'three_prime_UTR'
      subparts.unshift(
        new SimpleFeature({
          parent,
          id: `${parent.id()}_${type}_${i}`,
          data: { start, end, strand, type },
        }),
      )
    }
  }

  // make the right-hand UTRs
  if (!haveRightUTR) {
    for (let i = exons.length - 1; i >= 0; i--) {
      end = exons[i]!.get('end')
      if (end <= codeEnd) {
        break
      }

      start = Math.max(codeEnd, exons[i]!.get('start'))
      const type = strand >= 0 ? 'three_prime_UTR' : 'five_prime_UTR'
      subparts.push(
        new SimpleFeature({
          parent,
          id: `${parent.id()}_${type}_${i}`,
          data: { start, end, strand, type },
        }),
      )
    }
  }

  return subparts
}
