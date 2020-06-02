import { getConf } from '@gmod/jbrowse-core/configuration'
import { makeStyles } from '@material-ui/core/styles'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import { getParent } from 'mobx-state-tree'
import PropTypes from 'prop-types'
import React, { useState, useRef } from 'react'
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
  const [mouseCoord, setMouseCoord] = useState<[number, number]>([0, 0])
  const ref = useRef<HTMLDivElement>(null)
  const { model, children } = props
  const { featureUnderMouse: feature, trackMessageComponent: Message } = model
  const mouseover = feature ? getConf(model, 'mouseover', [feature]) : undefined
  return (
    <div
      ref={ref}
      data-testid={`track-${getConf(model, 'trackId')}`}
      className={classes.track}
      onMouseMove={event => {
        if (ref.current) {
          const rect = ref.current.getBoundingClientRect()
          setMouseCoord([event.clientX - rect.left, event.clientY - rect.top])
        }
      }}
      role="presentation"
    >
      {Message ? (
        <Message model={model} />
      ) : (
        <TrackBlocks {...props} viewModel={getParent(model, 2)} />
      )}
      {children}
      {mouseover ? (
        <Tooltip title={mouseover} open>
          <div
            style={{
              position: 'absolute',
              left: mouseCoord[0],
              top: mouseCoord[1],
            }}
          >
            {' '}
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
