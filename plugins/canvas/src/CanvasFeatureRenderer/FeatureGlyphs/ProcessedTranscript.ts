import { SimpleFeature, Feature } from '@jbrowse/core/util'

import SegmentsGlyph from './Segments'
import {
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'
import { LaidOutFeatureRect, ViewInfo } from '../FeatureGlyph'

function isUTR(feature: Feature) {
  return /(\bUTR|_UTR|untranslated[_\s]region)\b/.test(
    feature.get('type') || '',
  )
}

// returns a callback that will filter features features according to the
// subParts conf var
function makeSubpartsFilter(confKey: string | string[]) {
  const ret = ['CDS', 'UTR', 'five_prime_UTR', 'three_prime_UTR']

  return (feature: Feature) =>
    ret
      .map(typeName => typeName.toLowerCase())
      .includes(feature.get('type').toLowerCase())
}

function filterSubpart(feature: Feature) {
  return makeSubpartsFilter('subParts')(feature)
}

function makeCDSs(parent: Feature, subparts: Feature[]) {
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
  codeIndices.sort((a, b) => b - a)
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

    // "splice in" the calculated cds part into subparts at beginning of
    // _makeCDSs() method, bail if cds subparts are encountered
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

function makeUTRs(parent: Feature, subs: Feature[]) {
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
    for (let i = 0; i < exons.length; i++) {
      start = exons[i]!.get('start')
      if (start >= codeStart) {
        break
      }
      end = Math.min(codeStart, exons[i]!.get('end'))
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

export default class ProcessedTranscript extends SegmentsGlyph {
  protected getSubparts(f: Feature) {
    const c = f.children()
    const isTranscript = ['mRNA', 'transcript'].includes(f.get('type'))

    //     if (c && this.config.inferCdsParts) {
    //       c = this.makeCDSs(f, c)
    //     }

    //     if (c && this.config.impliedUTRs) {
    //       c = this.makeUTRs(f, c)
    //     }
    console.log({ c })

    return !c ? [] : c.filter(element => filterSubpart(element))
  }

  renderSegments(
    context: CanvasRenderingContext2D,
    viewInfo: ViewInfo,
    fRect: LaidOutFeatureRect,
  ) {
    const { t, f } = fRect
    const subfeatures = this.getSubparts(f)
    console.log({ subfeatures })
    subfeatures?.forEach(sub => {
      this.renderSegment(context, viewInfo, sub, t, fRect.rect.h)
    })
  }
}
