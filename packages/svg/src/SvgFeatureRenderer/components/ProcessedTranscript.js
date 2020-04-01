import { observer } from 'mobx-react'
import React from 'react'
import Segments from './Segments'
import { layOutFeature, layOutSubfeatures } from './util'

function ProcessedTranscript(props) {
  return <Segments {...props} />
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
  const subfeatures = (feature.get('subfeatures') || []).filter(subfeature =>
    ['CDS', 'UTR', 'five_prime_UTR', 'three_prime_UTR'].includes(
      subfeature.get('type'),
    ),
  )
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
