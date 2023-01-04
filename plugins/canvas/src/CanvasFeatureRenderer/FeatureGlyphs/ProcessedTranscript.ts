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

    let codeStart = Infinity,
      codeEnd = -Infinity

    // gather exons, find coding start and end
    let type
    const codeIndices = []
    const exons = []
    for (let i = 0; i < subparts.length; i++) {
      type = subparts[i].get('type')
      if (/^cds/i.test(type)) {
        // if any CDSs parts are present already,
        // bail and return all subparts as-is
        if (/:CDS:/i.test(subparts[i].get('name'))) {
          return subparts
        }

        codeIndices.push(i)
        if (codeStart > subparts[i].get('start')) {
          codeStart = subparts[i].get('start')
        }
        if (codeEnd < subparts[i].get('end')) {
          codeEnd = subparts[i].get('end')
        }
      } else {
        if (/exon/i.test(type)) {
          exons.push(subparts[i])
        }
      }
    }

    // splice out unspliced cds parts
    codeIndices.sort((a, b) => {
      return b - a
    })
    for (let i = codeIndices.length - 1; i >= 0; i--) {
      subparts.splice(codeIndices[i], 1)
    }

    // bail if we don't have exons and cds
    if (!(exons.length && codeStart < Infinity && codeEnd > -Infinity)) {
      return subparts
    }

    // make sure the exons are sorted by coord
    exons.sort((a, b) => a.get('start') - b.get('start'))

    // iterate thru exons again, and calculate cds parts
    const strand = parent.get('strand')
    let codePartStart = Infinity
    let codePartEnd = -Infinity
    for (let i = 0; i < exons.length; i++) {
      const start = exons[i].get('start')
      const end = exons[i].get('end')

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
          parent: parent,
          uniqueId: parent.get('uniqueID') + ':CDS:' + i,
          data: {
            start: codePartStart,
            end: codePartEnd,
            strand: strand,
            type: 'CDS',
            name: parent.get('uniqueID') + ':CDS:' + i,
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

    let codeStart = Infinity
    let codeEnd = -Infinity

    let haveLeftUTR
    let haveRightUTR

    // gather exons, find coding start and end, and look for UTRs
    let type
    const exons = [] as Feature[]
    subparts.forEach(sub => {
      type = sub.get('type')
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
    if (!(exons.length && codeStart < Infinity && codeEnd > -Infinity)) {
      return subparts
    }

    // make sure the exons are sorted by coord
    exons.sort((a, b) => a.get('start') - b.get('start'))

    const strand = parent.get('strand')

    // make the left-hand UTRs
    let start
    let end
    if (!haveLeftUTR) {
      for (let i = 0; i < exons.length; i++) {
        start = exons[i].get('start')
        if (start >= codeStart) {
          break
        }
        end = codeStart > exons[i].get('end') ? exons[i].get('end') : codeStart

        subparts.unshift(
          new SimpleFeature({
            parent: parent,
            uniqueId: 'wow', // FIXME
            data: {
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
        end = exons[i].get('end')
        if (end <= codeEnd) {
          break
        }

        start =
          codeEnd < exons[i].get('start') ? exons[i].get('start') : codeEnd
        subparts.push(
          new SimpleFeature({
            parent: parent,
            uniqueId: 'wow', // FIXME
            data: {
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
