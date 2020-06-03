import { getConf } from '@gmod/jbrowse-core/configuration'
import { makeStyles } from '@material-ui/core/styles'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import PropTypes from 'prop-types'
import React, { useState, useRef } from 'react'
import MUITooltip from '@material-ui/core/Tooltip'
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

const Tooltip = observer(
  (props: { model: BlockBasedTrackModel; mouseCoord: [number, number] }) => {
    const { model, mouseCoord } = props
    const { featureUnderMouse } = model
    const mouseover = featureUnderMouse
      ? getConf(model, 'mouseover', [featureUnderMouse])
      : undefined
    return mouseover ? (
      <MUITooltip title={mouseover} open>
        <div
          style={{
            position: 'absolute',
            left: mouseCoord[0],
            top: mouseCoord[1],
          }}
        >
          {' '}
        </div>
      </MUITooltip>
    ) : null
  },
)

function BlockBasedTrack(props: {
  model: BlockBasedTrackModel
  children: React.ReactNode
}) {
  const classes = useStyles()
  const [mouseCoord, setMouseCoord] = useState<[number, number]>([0, 0])
  const ref = useRef<HTMLDivElement>(null)
  const { model, children } = props
  const { TooltipComponent, TrackMessageComponent } = model

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
      {TrackMessageComponent ? (
        <TrackMessageComponent model={model} />
      ) : (
        <TrackBlocks {...props} />
      )}
      {children}
      <TooltipComponent model={model} mouseCoord={mouseCoord} />
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
export { Tooltip }
