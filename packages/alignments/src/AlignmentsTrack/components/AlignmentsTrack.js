import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import React from 'react'
import { YScaleBar } from '@gmod/jbrowse-plugin-wiggle/src/WiggleTrack/components/WiggleTrackComponent'
import AlignmentsBlockBasedTrack from './AlignmentsBlockBasedTrack'

function AlignmentsTrackComponent(props) {
  const { model } = props
  const { PileupTrack, SNPCoverageTrack } = model

  let showScalebar = false
  if (SNPCoverageTrack) {
    const { ready, stats, needsScalebar } = SNPCoverageTrack
    if (ready && stats && needsScalebar) showScalebar = true
  }

  return (
    <AlignmentsBlockBasedTrack
      {...props}
      {...PileupTrack}
      {...SNPCoverageTrack}
    >
      {showScalebar ? <YScaleBar model={SNPCoverageTrack} /> : null}
    </AlignmentsBlockBasedTrack>
  )
}

AlignmentsTrackComponent.propTypes = {
  model: MobxPropTypes.observableObject.isRequired,
}

export default observer(AlignmentsTrackComponent)
