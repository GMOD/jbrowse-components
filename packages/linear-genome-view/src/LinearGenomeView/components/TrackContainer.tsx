import { getConf } from '@gmod/jbrowse-core/configuration'
import { ResizeHandle } from '@gmod/jbrowse-core/ui'
import {
  useDebouncedCallback,
  getContainingView,
} from '@gmod/jbrowse-core/util'
import Paper from '@material-ui/core/Paper'
import Slide from '@material-ui/core/Slide'
import { makeStyles } from '@material-ui/core/styles'
import { observer } from 'mobx-react'
import { Instance, isAlive } from 'mobx-state-tree'
import React from 'react'
import { LinearGenomeViewStateModel, RESIZE_HANDLE_HEIGHT } from '..'
import { BaseTrackStateModel } from '../../BasicTrack/baseTrackModel'
import TrackLabel from './TrackLabel'

type LGV = Instance<LinearGenomeViewStateModel>

const useStyles = makeStyles(theme => ({
  root: {
    position: 'relative',
  },
  resizeHandle: {
    height: RESIZE_HANDLE_HEIGHT,
    boxSizing: 'border-box',
    position: 'relative',
    zIndex: 2,
  },
  overlay: {
    pointerEvents: 'none',
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    zIndex: 3,
    borderRadius: theme.shape.borderRadius,
  },
  renderingComponentContainer: {
    position: 'absolute',
    // -1 offset because of the 1px border of the Paper
    left: -1,
    height: '100%',
    width: '100%',
  },
  trackLabel: {
    position: 'absolute',
    zIndex: 3,
    margin: theme.spacing(1),
  },
  trackRenderingContainer: {
    overflowY: 'auto',
    overflowX: 'hidden',
    whiteSpace: 'nowrap',
    position: 'relative',
    background: 'none',
    zIndex: 2,
    boxSizing: 'content-box',
  },
}))

function TrackContainer(props: {
  model: LGV
  track: Instance<BaseTrackStateModel>
}) {
  const classes = useStyles()
  const { model, track } = props
  const { horizontalScroll, draggingTrackId, moveTrack } = model
  function onDragEnter() {
    if (
      draggingTrackId !== undefined &&
      isAlive(track) &&
      draggingTrackId !== track.id
    ) {
      moveTrack(draggingTrackId, track.id)
    }
  }
  const debouncedOnDragEnter = useDebouncedCallback(onDragEnter, 100)
  const { RenderingComponent, TrackBlurb } = track
  const view = getContainingView(track)
  const dimmed = draggingTrackId !== undefined && draggingTrackId !== track.id
  return (
    <div className={classes.root}>
      <Slide direction="right" in={model.showTrackLabels}>
        <TrackLabel track={track} className={classes.trackLabel} />
      </Slide>
      <Paper
        variant="outlined"
        className={classes.trackRenderingContainer}
        style={{ height: track.height }}
        onScroll={event => {
          const target = event.target as HTMLDivElement
          track.setScrollTop(target.scrollTop)
        }}
        onDragEnter={debouncedOnDragEnter}
        data-testid={`trackRenderingContainer-${view.id}-${getConf(
          track,
          'trackId',
        )}`}
        role="presentation"
      >
        <div
          className={classes.renderingComponentContainer}
          style={{ transform: `scaleX(${model.scaleFactor})` }}
        >
          <RenderingComponent
            model={track}
            blockState={{}}
            onHorizontalScroll={horizontalScroll}
          />
        </div>

        {TrackBlurb ? (
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: track.height - 20,
            }}
          >
            {' '}
            <TrackBlurb model={track} />
          </div>
        ) : null}
      </Paper>
      <div
        className={classes.overlay}
        style={{
          height: track.height,
          background: dimmed ? 'rgba(0, 0, 0, 0.4)' : undefined,
        }}
        onDragEnter={debouncedOnDragEnter}
      />
      <ResizeHandle
        onDrag={track.resizeHeight}
        className={classes.resizeHandle}
      />
    </div>
  )
}

export default observer(TrackContainer)
