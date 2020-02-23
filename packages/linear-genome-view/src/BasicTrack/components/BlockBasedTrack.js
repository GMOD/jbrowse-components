import { getConf } from '@gmod/jbrowse-core/configuration'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import { getParent } from 'mobx-state-tree'
import PropTypes from 'prop-types'
import React from 'react'
import Track from './Track'
// eslint-disable-next-line import/no-cycle
import TrackBlocks from './TrackBlocks'

function BlockBasedTrack(props) {
  const { model, children } = props
  return (
    <Track {...props} trackId={getConf(model, 'trackId')}>
      {model.trackMessageComponent ? (
        <model.trackMessageComponent model={model} />
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
