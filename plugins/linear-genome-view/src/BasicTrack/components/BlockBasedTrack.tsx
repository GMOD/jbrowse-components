import { getConf } from '@gmod/jbrowse-core/configuration'
import { Menu } from '@gmod/jbrowse-core/ui'
import { useTheme, makeStyles } from '@material-ui/core/styles'
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
      <MUITooltip title={mouseover} open placement="right">
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

type Coord = [number, number]
export function BlockBasedTrackC(props: {
  model: BlockBasedTrackModel
  children: React.ReactNode
}) {
  const classes = useStyles()
  const theme = useTheme()

  const [mouseCoord, setMouseCoord] = useState<Coord>([0, 0])
  const [contextCoord, setContextCoord] = useState<Coord>()
  const ref = useRef<HTMLDivElement>(null)
  const { model, children } = props
  const {
    TooltipComponent,
    TrackMessageComponent,
    contextMenuItems,
    height,
    setContextMenuFeature,
  } = model

  return (
    <div
      ref={ref}
      data-testid={`track-${getConf(model, 'trackId')}`}
      className={classes.track}
      onContextMenu={event => {
        event.preventDefault()
        if (contextCoord) {
          // There's already a context menu open, so close it
          setContextCoord(undefined)
        } else if (ref.current) {
          setContextCoord([event.clientX, event.clientY])
        }
      }}
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
      <TooltipComponent model={model} height={height} mouseCoord={mouseCoord} />

      <Menu
        open={Boolean(contextCoord) && Boolean(contextMenuItems.length)}
        onMenuItemClick={(_, callback) => {
          callback()
          setContextCoord(undefined)
        }}
        onClose={() => {
          setContextCoord(undefined)
          setContextMenuFeature(undefined)
        }}
        onExit={() => {
          setContextCoord(undefined)
          setContextMenuFeature(undefined)
        }}
        anchorReference="anchorPosition"
        anchorPosition={
          contextCoord
            ? { top: contextCoord[1], left: contextCoord[0] }
            : undefined
        }
        style={{ zIndex: theme.zIndex.tooltip }}
        menuItems={contextMenuItems}
        data-testid="block_based_track_context_menu"
      />
    </div>
  )
}

BlockBasedTrackC.propTypes = {
  model: MobxPropTypes.objectOrObservableObject.isRequired,
  children: PropTypes.node,
}

BlockBasedTrackC.defaultProps = {
  children: null,
}

export default observer(BlockBasedTrackC)
export { Tooltip }
