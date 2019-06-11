import { getConf } from '@gmod/jbrowse-core/configuration'
import { observer, propTypes as mobxPropTypes } from 'mobx-react'
import React from 'react'
import Track from './Track'
import TrackBlocks from './TrackBlocks'

function BlockBasedTrack(props) {
  const { model, children } = props
  return (
    <Track {...props} trackId={getConf(model, 'configId')}>
      {model.trackMessageComponent ? (
        <model.trackMessageComponent model={model} />
      ) : (
        <TrackBlocks {...props} blockState={model.blockState} />
      )}
      {children}
    </Track>
  )
}

BlockBasedTrack.propTypes = {
  model: mobxPropTypes.objectOrObservableObject.isRequired,
}

export default observer(BlockBasedTrack)
