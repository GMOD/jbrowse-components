import { observer } from 'mobx-react'
import React from 'react'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { readConfObject } from '@jbrowse/core/configuration'
import Segments from './Segments'
import { layOutFeature, layOutSubfeatures } from './util'

function ProcessedTranscript(props) {
  // eslint-disable-next-line react/prop-types
  const { feature, config } = props
  const subfeatures = getSubparts(feature, config)

  // we manually compute some subfeatures, so pass these separately
  return <Segments {...props} subfeatures={subfeatures} />
}

// make a function that will filter features features according to the
// subParts conf var
function makeSubpartsFilter(confKey = 'subParts', config) {
  let filter = readConfObject(config, confKey)

  if (typeof filter == 'string') {
    // convert to array
    filter = filter.split(/\s*,\s*/)
  }

  if (Array.isArray(filter)) {
    const typeNames = filter.map(typeName => typeName.toLowerCase())
    return feature => {
      return typeNames.includes(feature.get('type').toLowerCase())
    }
  }
  if (typeof filter === 'function') {
    return filter
  }
  return () => true
}

function filterSubpart(feature, config) {
  return makeSubpartsFilter('subParts', config)(feature)
}

function isUTR(feature) {
  return /(\bUTR|_UTR|untranslated[_\s]region)\b/.test(
    feature.get('type') || '',
  )
}

function makeUTRs(parent, subs) {
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

function getSubparts(f, config) {
  let c = f.get('subfeatures')
  if (!c || !c.length) {
    return []
  }
  const hasUTRs = !!c.find(child => isUTR(child))
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
}) => {
  const subLayout = layOutFeature({
    layout,
    feature,
    bpPerPx,
    reversed,
    config,
  })
  const subfeatures = getSubparts(feature, config)
  layOutSubfeatures({
    layout: subLayout,
    subfeatures,
    bpPerPx,
    reversed,
    config,
  })
  return subLayout
}

export default observer(ProcessedTranscript)
