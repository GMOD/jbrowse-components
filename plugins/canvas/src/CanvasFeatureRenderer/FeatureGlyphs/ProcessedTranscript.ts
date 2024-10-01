import SegmentsGlyph from './Segments'
import { SimpleFeature, Feature } from '@jbrowse/core/util'
import { ViewInfo } from '../FeatureGlyph'

export default class ProcessedTranscript extends SegmentsGlyph {
  protected getSubparts(f: Feature) {
    const c = f.children()
    if (!c) {
      return []
    }

    //     if (c && this.config.inferCdsParts) {
    //       c = this.makeCDSs(f, c)
    //     }

    //     if (c && this.config.impliedUTRs) {
    //       c = this.makeUTRs(f, c)
    //     }

    return c
  }

  protected makeCDSs(parent: Feature, subparts: Feature[]) {
    // infer CDS parts from exon coordinates

    let codeStart = Number.POSITIVE_INFINITY
    let codeEnd = Number.NEGATIVE_INFINITY

    // gather exons, find coding start and end
    let type: string
    const codeIndices = []
    const exons = []
    for (let i = 0; i < subparts.length; i++) {
      const subpart = subparts[i]!
      type = subpart.get('type')
      if (/^cds/i.test(type)) {
        // if any CDSs parts are present already,
        // bail and return all subparts as-is
        if (/:CDS:/i.test(subpart.get('name'))) {
          return subparts
        }

        codeIndices.push(i)
        if (codeStart > subpart.get('start')) {
          codeStart = subpart.get('start')
        }
        if (codeEnd < subpart.get('end')) {
          codeEnd = subpart.get('end')
        }
      } else {
        if (/exon/i.test(type)) {
          exons.push(subpart)
        }
      }
    }

    // splice out unspliced cds parts
    codeIndices.sort((a, b) => {
      return b - a
    })
    for (let i = codeIndices.length - 1; i >= 0; i--) {
      subparts.splice(codeIndices[i]!, 1)
    }

    // bail if we don't have exons and cds
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

    // iterate thru exons again, and calculate cds parts
    const strand = parent.get('strand')
    let codePartStart = Number.POSITIVE_INFINITY
    let codePartEnd = Number.NEGATIVE_INFINITY
    for (let i = 0; i < exons.length; i++) {
      const start = exons[i]!.get('start')
      const end = exons[i]!.get('end')

      // CDS containing exon
      if (codeStart >= start && codeEnd <= end) {
        codePartStart = codeStart
        codePartEnd = codeEnd
      }
      // 5' terminal CDS part
      else if (codeStart >= start && codeStart < end) {
        codePartStart = codeStart
        codePartEnd = end
      }
      // 3' terminal CDS part
      else if (codeEnd > start && codeEnd <= end) {
        codePartStart = start
        codePartEnd = codeEnd
      }
      // internal CDS part
      else if (start < codeEnd && end > codeStart) {
        codePartStart = start
        codePartEnd = end
      }

      // "splice in" the calculated cds part into subparts
      // at beginning of _makeCDSs() method, bail if cds subparts are encountered
      subparts.splice(
        i,
        0,
        new SimpleFeature({
          id: `${parent.get('uniqueID')}:CDS:${i}`,
          data: {
            parent: parent,
            start: codePartStart,
            end: codePartEnd,
            strand: strand,
            type: 'CDS',
            name: `${parent.get('uniqueID')}:CDS:${i}`,
          },
        }),
      )
    }

    // make sure the subparts are sorted by coord
    return subparts.sort((a, b) => a.get('start') - b.get('start'))
  }

  protected makeUTRs(parent: Feature, subparts: Feature[]) {
    // based on Lincoln's UTR-making code in
    // Bio::Graphics::Glyph::processed_transcript

    let codeStart = Number.POSITIVE_INFINITY
    let codeEnd = Number.NEGATIVE_INFINITY

    let haveLeftUTR: boolean | undefined
    let haveRightUTR: boolean | undefined

    // gather exons, find coding start and end, and look for UTRs
    const exons = [] as Feature[]
    subparts.forEach(sub => {
      const type = sub.get('type')
      if (/^cds/i.test(type)) {
        if (codeStart > sub.get('start')) {
          codeStart = sub.get('start')
        }
        if (codeEnd < sub.get('end')) {
          codeEnd = sub.get('end')
        }
      } else if (/exon/i.test(type)) {
        exons.push(sub)
      } else if (this.isUTR(sub)) {
        haveLeftUTR = sub.get('start') === parent.get('start')
        haveRightUTR = sub.get('end') === parent.get('end')
      }
    })

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
    let start: number
    let end: number
    if (!haveLeftUTR) {
      // eslint-disable-next-line @typescript-eslint/prefer-for-of
      for (let i = 0; i < exons.length; i++) {
        const exon = exons[i]!
        start = exon.get('start')
        if (start >= codeStart) {
          break
        }
        end = codeStart > exon.get('end') ? exon.get('end') : codeStart

        subparts.unshift(
          new SimpleFeature({
            id: 'wow', // FIXME
            data: {
              parent: parent,
              start: start,
              end: end,
              strand: strand,
              type: strand >= 0 ? 'five_prime_UTR' : 'three_prime_UTR',
            },
          }),
        )
      }
    }

    // make the right-hand UTRs
    if (!haveRightUTR) {
      for (let i = exons.length - 1; i >= 0; i--) {
        const exon = exons[i]!
        end = exon.get('end')
        if (end <= codeEnd) {
          break
        }

        start = codeEnd < exon.get('start') ? exon.get('start') : codeEnd
        subparts.push(
          new SimpleFeature({
            id: 'wow', // FIXME
            data: {
              parent: parent,
              start: start,
              end: end,
              strand: strand,
              type: strand >= 0 ? 'three_prime_UTR' : 'five_prime_UTR',
            },
          }),
        )
      }
    }

    return subparts
  }

  protected isUTR(feature: Feature) {
    return /(\bUTR|_UTR|untranslated[_\s]region)\b/.test(
      feature.get('type') || '',
    )
  }

  getFeatureHeight(viewInfo: ViewInfo, feature: Feature) {
    const height = super.getFeatureHeight(viewInfo, feature)

    if (this.isUTR(feature)) {
      return height * 0.6
    }

    return height
  }
}
