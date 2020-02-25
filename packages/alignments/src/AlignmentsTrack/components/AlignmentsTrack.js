// import { getConf } from '@gmod/jbrowse-core/configuration'
import BlockBasedTrack from '@gmod/jbrowse-plugin-linear-genome-view/src/BasicTrack/components/BlockBasedTrack'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import React from 'react'
import { YScaleBar } from '@gmod/jbrowse-plugin-wiggle/src/WiggleTrack/components/WiggleTrackComponent'

function AlignmentsTrackComponent(props) {
  const { model } = props
  const { PileupTrack, SNPCoverageTrack } = model

  let showScalebar = false
  if (SNPCoverageTrack) {
    const { ready, stats, needsScalebar } = SNPCoverageTrack
    if (ready && stats && needsScalebar) showScalebar = true
  }

  return (
    <BlockBasedTrack {...props} {...PileupTrack} {...SNPCoverageTrack}>
      {showScalebar ? <YScaleBar model={SNPCoverageTrack} /> : null}
    </BlockBasedTrack>
  )
}

AlignmentsTrackComponent.propTypes = {
  model: MobxPropTypes.observableObject.isRequired,
}

export default observer(AlignmentsTrackComponent)
