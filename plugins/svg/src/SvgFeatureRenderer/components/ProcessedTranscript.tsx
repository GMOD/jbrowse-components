import React from 'react'
import { observer } from 'mobx-react'
import {
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'

import Segments from './Segments'
import { ExtraGlyphValidator, layOutFeature, layOutSubfeatures } from './util'
import { SceneGraph } from '@jbrowse/core/util/layouts'
import { Region, Feature, SimpleFeature } from '@jbrowse/core/util'

function ProcessedTranscript(props: {
  feature: Feature
  region: Region
  config: AnyConfigurationModel
  featureLayout: SceneGraph
  selected?: boolean
  reversed?: boolean
  [key: string]: unknown
}) {
  const { feature, config } = props
  const subfeatures = getSubparts(feature, config)

  // we manually compute some subfeatures, so pass these separately
  return <Segments {...props} subfeatures={subfeatures} />
}

// returns a callback that will filter features features according to the
// subParts conf var
function makeSubpartsFilter(
  confKey = 'subParts',
  config: AnyConfigurationModel,
) {
  let filter = readConfObject(config, confKey) as string[] | string

  if (typeof filter == 'string') {
    // convert to array
    filter = filter.split(/\s*,\s*/)
  }

  return (feature: Feature) =>
    (filter as string[])
      .map(typeName => typeName.toLowerCase())
      .includes(feature.get('type').toLowerCase())
}

function filterSubpart(feature: Feature, config: AnyConfigurationModel) {
  return makeSubpartsFilter('subParts', config)(feature)
}

function isUTR(feature: Feature) {
  return /(\bUTR|_UTR|untranslated[_\s]region)\b/.test(
    feature.get('type') || '',
  )
}

function makeUTRs(parent: Feature, subs: Feature[]) {
  // based on Lincoln's UTR-making code in Bio::Graphics::Glyph::processed_transcript
  const subparts = [...subs]

  let codeStart = Infinity
  let codeEnd = -Infinity

  let haveLeftUTR
  let haveRightUTR

  // gather exons, find coding start and end, and look for UTRs
  const exons = []
  for (let i = 0; i < subparts.length; i++) {
    const type = subparts[i].get('type')
    if (/^cds/i.test(type)) {
      if (codeStart > subparts[i].get('start')) {
        codeStart = subparts[i].get('start')
      }
      if (codeEnd < subparts[i].get('end')) {
        codeEnd = subparts[i].get('end')
      }
    } else if (/exon/i.test(type)) {
      exons.push(subparts[i])
    } else if (isUTR(subparts[i])) {
      haveLeftUTR = subparts[i].get('start') === parent.get('start')
      haveRightUTR = subparts[i].get('end') === parent.get('end')
    }
  }

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
      end = exons[i].get('end')
      if (end <= codeEnd) {
        break
      }

      start = codeEnd < exons[i].get('start') ? exons[i].get('start') : codeEnd
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

function getSubparts(f: Feature, config: AnyConfigurationModel) {
  let c = f.get('subfeatures')
  if (!c || c.length === 0) {
    return []
  }
  const hasUTRs = c.some(child => isUTR(child))
  const isTranscript = ['mRNA', 'transcript'].includes(f.get('type'))
  const impliedUTRs = !hasUTRs && isTranscript

  // if we think we should use impliedUTRs, or it is specifically in the
  // config, then makeUTRs
  if (impliedUTRs || readConfObject(config, 'impliedUTRs')) {
    c = makeUTRs(f, c)
  }

  return c.filter(element => filterSubpart(element, config))
}

ProcessedTranscript.layOut = ({
  layout,
  feature,
  bpPerPx,
  reversed,
  config,
  extraGlyphs,
}: {
  layout: SceneGraph
  feature: Feature
  bpPerPx: number
  reversed: boolean
  config: AnyConfigurationModel
  extraGlyphs: ExtraGlyphValidator[]
}) => {
  const subLayout = layOutFeature({
    layout,
    feature,
    bpPerPx,
    reversed,
    config,
    extraGlyphs,
  })
  const subfeatures = getSubparts(feature, config)
  layOutSubfeatures({
    layout: subLayout,
    subfeatures,
    bpPerPx,
    reversed,
    config,
    extraGlyphs,
  })
  return subLayout
}

export default observer(ProcessedTranscript)
