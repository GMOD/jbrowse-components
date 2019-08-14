import { observer } from 'mobx-react'
import React from 'react'
import Segments from './Segments'
import { layOutFeatures, layOutSubfeatures } from './util'

function ProcessedTranscript(props) {
  return <Segments {...props} />
}

ProcessedTranscript.layOut = ({
  layout,
  feature,
  region,
  bpPerPx,
  horizontallyFlipped,
  config,
}) => {
  const subLayout = layOutFeatures({
    layout,
    feature,
    region,
    bpPerPx,
    horizontallyFlipped,
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
    region,
    bpPerPx,
    horizontallyFlipped,
    config,
  })
  return subLayout
}

export default observer(ProcessedTranscript)
