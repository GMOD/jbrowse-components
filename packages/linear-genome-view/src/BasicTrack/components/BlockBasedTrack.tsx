import { getConf } from '@gmod/jbrowse-core/configuration'
import { makeStyles } from '@material-ui/core/styles'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import { getParent } from 'mobx-state-tree'
import PropTypes from 'prop-types'
import React from 'react'
import Tooltip from '@material-ui/core/Tooltip'
import TrackBlocks from './TrackBlocks'
import { BlockBasedTrackModel } from '../blockBasedTrackModel'

const useStyles = makeStyles({
  track: {
    position: 'relative',
    whiteSpace: 'nowrap',
    textAlign: 'left',
    width: '100%',
    minHeight: '100%',
  },
})

function BlockBasedTrack(props: {
  model: BlockBasedTrackModel
  children: React.ReactNode
}) {
  const classes = useStyles()
  const { model, children } = props
  const { featureIdUnderMouse, trackMessageComponent: Message } = model
  return (
    <div
      data-testid={`track-${getConf(model, 'trackId')}`}
      className={classes.track}
      role="presentation"
    >
      {Message ? (
        <Message model={model} />
      ) : (
        <TrackBlocks {...props} viewModel={getParent(model, 2)} />
      )}
      {children}
      {featureIdUnderMouse ? (
        <Tooltip title="test" open>
          <div style={{ position: 'absolute', left: 50, top: 50 }}>
            Hello world!
          </div>
        </Tooltip>
      ) : null}
    </div>
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
