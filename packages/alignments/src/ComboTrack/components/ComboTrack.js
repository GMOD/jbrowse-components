// import { getConf } from '@gmod/jbrowse-core/configuration'
import BlockBasedTrack from '@gmod/jbrowse-plugin-linear-genome-view/src/BasicTrack/components/BlockBasedTrack'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import React from 'react'

function ComboTrackComponent(props) {
  const { model } = props
  const { AlignmentsTrack, SNPCoverageTrack } = model
  console.log(AlignmentsTrack)
  return (
    <BlockBasedTrack
      {...props}
      {...AlignmentsTrack}
      // {...SNPCoverageTrack} // Still need to write function to wrap adapter in a sub adapter
    ></BlockBasedTrack>
  )
}

ComboTrackComponent.propTypes = {
  model: MobxPropTypes.observableObject.isRequired,
}

export default observer(ComboTrackComponent)
