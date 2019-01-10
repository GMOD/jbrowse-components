import React from 'react'
import { observer, PropTypes } from 'mobx-react'

import TrackBlocks from '../../LinearGenomeView/components/TrackBlocks'

import './SequenceTrack.scss'

const SequenceTrack = observer(props => {
  const { blockState } = props.model
  return (
    <div className="SequenceTrack">
      <TrackBlocks {...props} blockState={blockState} />
    </div>

})

SequenceTrack.propTypes = {
  model: PropTypes.observableObject.isRequired,
}

export default SequenceTrack
