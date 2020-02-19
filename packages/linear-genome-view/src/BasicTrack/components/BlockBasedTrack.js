/* eslint-disable no-nested-ternary */
import { getConf } from '@gmod/jbrowse-core/configuration'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import { getParent } from 'mobx-state-tree'
import PropTypes from 'prop-types'
import React from 'react'
import Track from './Track'
import TrackBlocks from './TrackBlocks'
import ComboTrackBlocks from './ComboTrackBlocks'

function BlockBasedTrack(props) {
  const { model, children } = props
  return (
    <Track {...props} trackId={getConf(model, 'trackId')}>
      {model.trackMessageComponent ? (
        <model.trackMessageComponent model={model} />
      ) : getConf(model, 'type') === 'ComboTrack' ? (
        <ComboTrackBlocks {...props} viewModel={getParent(getParent(model))} />
      ) : (
        <TrackBlocks {...props} viewModel={getParent(getParent(model))} />
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
