import { Icon, IconButton, withStyles } from '@material-ui/core'
import ToggleButton from '@material-ui/lab/ToggleButton'
import classnames from 'classnames'
import { observer, PropTypes } from 'mobx-react'
import { getRoot } from 'mobx-state-tree'
import ReactPropTypes from 'prop-types'
import React, { useState, useRef } from 'react'

import ScaleBar from './ScaleBar'
import Rubberband from './Rubberband'
import TrackRenderingContainer from './TrackRenderingContainer'
import TrackResizeHandle from './TrackResizeHandle'

import ZoomControls from './ZoomControls'

import buttonStyles from './buttonStyles'

const dragHandleHeight = 3

const styles = theme => ({
  root: {
    position: 'relative',
    marginBottom: theme.spacing(1),
    overflow: 'hidden',
  },
  linearGenomeView: {
    background: '#eee',
    // background: theme.palette.background.paper,
    boxSizing: 'content-box',
  },
  controls: {
    borderRight: '1px solid gray',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
  },
  viewControls: {
    height: '100%',
    borderBottom: '1px solid #9e9e9e',
    boxSizing: 'border-box',
  },
  trackControls: {
    whiteSpace: 'normal',
  },
  zoomControls: {
    position: 'absolute',
    top: '0px',
  },
  rubberband: {
    height: '10000px',
    background: '#aad8',
    position: 'absolute',
    zIndex: 9999,
  },
  rubberBandContainer: {
    position: 'relative',
    cursor: 'crosshair',
    zIndex: 999,
  },

  ...buttonStyles(theme),
})

const HighlightRegion = props => {
  const { classes, rubberband } = props

  let leftPx
  let rightPx
  if (rubberband) {
    ;[leftPx, rightPx] = rubberband
    if (rightPx < leftPx) {
      ;[leftPx, rightPx] = [rightPx, leftPx]
    }
  }
  return (
    <div
      className={classes.rubberband}
      style={{
        left: leftPx,
        width: rightPx - leftPx,
      }}
    />
  )
}


function LinearGenomeView(props) {
  const scaleBarHeight = 32
  const { classes, model } = props
  const rootModel = getRoot(model)
  const {
    id,
    staticBlocks,
    tracks,
    bpPerPx,
    width,
    controlsWidth,
    offsetPx,
  } = model

  // Scrolling event handlers
  const [mouseState, setMouseState] = useState({
    dragging: false,
    previousMouseX: undefined,
  })
  // Rubberband event handlers
  const [rubberbandState, setRubberbandState] = useState({
    dragging: false,
  })

  /*
   * NOTE: offsetPx is the total offset in px of the viewing window into the
   * whole set of concatenated regions. this number is often quite large.
   */
  const height =
    scaleBarHeight + tracks.reduce((a, b) => a + b.height + dragHandleHeight, 0)
  const style = {
    display: 'grid',
    width: `${width}px`,
    height: `${height}px`,
    position: 'relative',
    gridTemplateRows: `[scale-bar] auto ${tracks
      .map(
        t =>
          `[track-${t.id}] ${t.height}px [resize-${
            t.id
          }] ${dragHandleHeight}px`,
      )
      .join(' ')}`,
    gridTemplateColumns: `[controls] ${controlsWidth}px [blocks] auto`,
  }
  return (
    <div className={classes.root}>
      <div
        className={classes.linearGenomeView}
        key={`view-${id}`}
        style={style}
        onWheel={event => model.horizontalScroll(event.deltaX)}
        onMouseMove={event => {
          if (mouseState.dragging && mouseState.previousMouseX !== undefined) {
            const distance = event.clientX - mouseState.previousMouseX
            if (distance) model.horizontalScroll(-distance)
          }
          setMouseState({
            dragging: mouseState.dragging,
            previousMouseX: event.clientX,
          })
          if (rubberbandState.dragging) {
            // prevent mouse selections over text
            event.preventDefault()
            setRubberbandState({
              ...rubberbandState,
              end: event.clientX,
            })
          }
        }}
        onMouseLeave={event =>
          setMouseState({ dragging: false, previousMouseX: undefined })
        }
        onMouseDown={event => {
          setMouseState({ dragging: true, previousMouseX: event.clientX })
        }}
        onMouseUp={event => {
          setMouseState({ dragging: false, previousMouseX: undefined })
          if (rubberbandState.dragging) {
            setRubberbandState({ dragging: false })
            let leftPx = rubberbandState.start - model.controlsWidth
            let rightPx = rubberbandState.end - model.controlsWidth
            if (rightPx < leftPx) {
              ;[leftPx, rightPx] = [rightPx, leftPx]
            }
            if (rightPx - leftPx > 3) {
              const leftOffset = model.pxToBp(leftPx)
              const rightOffset = model.pxToBp(rightPx)
              model.moveTo(leftOffset, rightOffset)
            }
          }
        }}
      >
        <div
          className={classnames(classes.controls, classes.viewControls)}
          style={{ gridRow: 'scale-bar' }}
        >
          {model.hideControls ? null : (
            <>
              <IconButton
                onClick={model.closeView}
                className={classes.iconButton}
                title="close this view"
              >
                <Icon fontSize="small">close</Icon>
              </IconButton>
              <ToggleButton
                onClick={model.activateTrackSelector}
                title="select tracks"
                className={classes.toggleButton}
                selected={
                  rootModel.visibleDrawerWidget &&
                  rootModel.visibleDrawerWidget.id ===
                    'hierarchicalTrackSelector' &&
                  rootModel.visibleDrawerWidget.view.id === model.id
                }
                value="track_select"
                data_testid="track_select"
              >
                <Icon fontSize="small">line_style</Icon>
              </ToggleButton>
            </>
          )}
        </div>

        <ScaleBar
          style={{
            gridColumn: 'blocks',
            gridRow: 'scale-bar',
            cursor: 'crosshair',
          }}
          height={scaleBarHeight}
          bpPerPx={bpPerPx}
          blocks={staticBlocks}
          offsetPx={offsetPx}
          horizontallyFlipped={model.horizontallyFlipped}
          width={model.viewingRegionWidth}
          onMouseDown={event => {
            setRubberbandState({
              dragging: true,
              start: event.clientX,
              end: event.clientX + 1,
            })
            event.stopPropagation()
          }}
        />
        {rubberbandState.dragging ? (
          <HighlightRegion
            rubberband={[rubberbandState.start, rubberbandState.end]}
            {...props}
          />
        ) : null}

        <div
          className={classes.zoomControls}
          style={{
            right: 4,
            zIndex: 1000,
          }}
        >
          <ZoomControls model={model} controlsHeight={scaleBarHeight} />
        </div>
        {tracks.map(track => [
          <div
            className={classnames(classes.controls, classes.trackControls)}
            key={`controls:${track.id}`}
            style={{ gridRow: `track-${track.id}`, gridColumn: 'controls' }}
          >
            <track.ControlsComponent
              track={track}
              key={track.id}
              view={model}
              onConfigureClick={track.activateConfigurationUI}
            />
          </div>,
          <TrackRenderingContainer
            key={`track-rendering:${track.id}`}
            trackId={track.id}
            width={model.viewingRegionWidth}
            height={track.height}
          >
            <track.RenderingComponent
              model={track}
              offsetPx={offsetPx}
              bpPerPx={bpPerPx}
              blockState={{}}
            />
          </TrackRenderingContainer>,
          <TrackResizeHandle
            key={`handle:${track.id}`}
            trackId={track.id}
            onVerticalDrag={model.resizeTrack}
          />,
        ])}
      </div>
    </div>
  )
}
LinearGenomeView.propTypes = {
  classes: ReactPropTypes.objectOf(ReactPropTypes.string).isRequired,
  model: PropTypes.objectOrObservableObject.isRequired,
}

export default withStyles(styles)(observer(LinearGenomeView))
