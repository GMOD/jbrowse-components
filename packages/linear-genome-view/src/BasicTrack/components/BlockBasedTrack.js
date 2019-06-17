import { getConf } from '@gmod/jbrowse-core/configuration'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import PropTypes from 'prop-types'
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
  model: MobxPropTypes.objectOrObservableObject.isRequired,
  children: PropTypes.node,
}

BlockBasedTrack.defaultProps = {
  children: null,
}

export default observer(BlockBasedTrack)
