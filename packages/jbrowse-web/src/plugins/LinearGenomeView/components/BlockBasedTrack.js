import React from 'react'
import { observer, propTypes as mobxPropTypes } from 'mobx-react'
import Track from './Track'
import TrackBlocks from './TrackBlocks'

function BlockBasedTrack(props) {
  const { model } = props
  return (
    <Track {...props}>
      {model.trackMessageComponent ? (
        <model.trackMessageComponent model={model} />
      ) : (
        <TrackBlocks {...props} blockState={model.blockState} />
      )}
    </Track>
  )
}

BlockBasedTrack.propTypes = {
  model: mobxPropTypes.objectOrObservableObject.isRequired,
}

export default observer(BlockBasedTrack)
