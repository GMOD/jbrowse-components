import React from 'react'
import { observer } from 'mobx-react'

import ZoomOut from '@material-ui/icons/ZoomOut'
import ZoomIn from '@material-ui/icons/ZoomIn'
import RotateLeft from '@material-ui/icons/RotateLeft'
import RotateRight from '@material-ui/icons/RotateRight'
import LockOutline from '@material-ui/icons/LockOutlined'
import LockOpen from '@material-ui/icons/LockOpen'
import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'

// material-ui stuff
import { IconButton, makeStyles } from '@material-ui/core'

import { grey } from '@material-ui/core/colors'

import { ResizeHandle } from '@jbrowse/core/ui'
import { assembleLocString } from '@jbrowse/core/util'
import Ruler from './Ruler'
import ImportForm from './ImportForm'

const dragHandleHeight = 3

const useStyles = makeStyles(theme => {
  return {
    root: {
      position: 'relative',
      marginBottom: theme.spacing(1),
      overflow: 'hidden',
      background: 'white',
    },
    scroller: {
      overflow: 'auto',
    },
    sliceRoot: {
      background: 'none',
      // background: theme.palette.background.paper,
      boxSizing: 'content-box',
      display: 'block',
    },
    iconButton: {
      padding: '4px',
      margin: '0 2px 0 2px',
    },
    controls: {
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      position: 'absolute',
      background: grey[200],
      boxSizing: 'border-box',
      borderRight: '1px solid #a2a2a2',
      borderBottom: '1px solid #a2a2a2',
      left: 0,
      top: 0,
    },
    importFormContainer: {
      marginBottom: theme.spacing(4),
    },
  }
})

const Slices = observer(({ model }) => {
  return (
    <>
      <>
        {model.staticSlices.map(slice => {
          return (
            <Ruler
              key={assembleLocString(
                slice.region.elided ? slice.region.regions[0] : slice.region,
              )}
              model={model}
              slice={slice}
            />
          )
        })}
      </>
      <>
        {model.tracks.map(track => {
          const display = track.displays[0]
          return (
            <display.RenderingComponent
              key={display.id}
              display={display}
              view={model}
            />
          )
        })}
      </>
    </>
  )
})

const Controls = observer(({ model, showingFigure }) => {
  const classes = useStyles()
  return (
    <div className={classes.controls}>
      <IconButton
        onClick={model.zoomOutButton}
        className={classes.iconButton}
        title={model.lockedFitToWindow ? 'unlock to zoom out' : 'zoom out'}
        disabled={
          !showingFigure || model.atMaxBpPerPx || model.lockedFitToWindow
        }
        color="secondary"
      >
        <ZoomOut />
      </IconButton>

      <IconButton
        onClick={model.zoomInButton}
        className={classes.iconButton}
        title="zoom in"
        disabled={!showingFigure || model.atMinBpPerPx}
        color="secondary"
      >
        <ZoomIn />
      </IconButton>

      <IconButton
        onClick={model.rotateCounterClockwiseButton}
        className={classes.iconButton}
        title="rotate counter-clockwise"
        disabled={!showingFigure}
        color="secondary"
      >
        <RotateLeft />
      </IconButton>

      <IconButton
        onClick={model.rotateClockwiseButton}
        className={classes.iconButton}
        title="rotate clockwise"
        disabled={!showingFigure}
        color="secondary"
      >
        <RotateRight />
      </IconButton>

      <IconButton
        onClick={model.toggleFitToWindowLock}
        className={classes.iconButton}
        title={
          model.lockedFitToWindow
            ? 'locked model to window size'
            : 'unlocked model to zoom further'
        }
        disabled={model.tooSmallToLock}
        color="secondary"
      >
        {model.lockedFitToWindow ? <LockOutline /> : <LockOpen />}
      </IconButton>

      {model.hideTrackSelectorButton ? null : (
        <IconButton
          onClick={model.activateTrackSelector}
          title="Open track selector"
          data-testid="circular_track_select"
          color="secondary"
        >
          <TrackSelectorIcon />
        </IconButton>
      )}
    </div>
  )
})

const CircularView = observer(({ model }) => {
  const classes = useStyles()
  const initialized =
    !!model.displayedRegions.length && model.figureWidth && model.figureHeight

  const showImportForm = !initialized && !model.disableImportForm
  const showFigure = initialized && !showImportForm

  return (
    <div
      className={classes.root}
      style={{
        width: model.width,
        height: model.height,
      }}
      data-testid={model.id}
    >
      {model.error ? (
        <p style={{ color: 'red' }}>{model.error.message}</p>
      ) : (
        <>
          {showImportForm ? <ImportForm model={model} /> : null}
          <>
            {!showFigure ? null : (
              <div
                className={classes.scroller}
                style={{
                  width: model.width,
                  height: model.height,
                }}
              >
                <div
                  className={classes.rotator}
                  style={{
                    transform: [`rotate(${model.offsetRadians}rad)`].join(' '),
                    transition: 'transform 0.5s',
                    transformOrigin: model.centerXY
                      .map(x => `${x}px`)
                      .join(' '),
                  }}
                >
                  <svg
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                    }}
                    className={classes.sliceRoot}
                    width={`${model.figureWidth}px`}
                    height={`${model.figureHeight}px`}
                    version="1.1"
                  >
                    <g transform={`translate(${model.centerXY})`}>
                      <Slices model={model} />
                    </g>
                  </svg>
                </div>
              </div>
            )}
            <Controls model={model} showingFigure={showFigure} />
            {model.hideVerticalResizeHandle ? null : (
              <ResizeHandle
                onDrag={model.resizeHeight}
                style={{
                  height: dragHandleHeight,
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  background: '#ccc',
                  boxSizing: 'border-box',
                  borderTop: '1px solid #fafafa',
                }}
              />
            )}
          </>
        </>
      )}
    </div>
  )
})

export default CircularView
