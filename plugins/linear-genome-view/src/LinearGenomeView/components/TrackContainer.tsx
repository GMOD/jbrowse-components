import React, { useEffect, useRef } from 'react'
import { observer } from 'mobx-react'
import { isAlive } from 'mobx-state-tree'
import { getConf } from '@gmod/jbrowse-core/configuration'
import { ResizeHandle } from '@gmod/jbrowse-core/ui'
import {
  useDebouncedCallback,
  getContainingView,
} from '@gmod/jbrowse-core/util'
import clsx from 'clsx'
import Paper from '@material-ui/core/Paper'
import { makeStyles } from '@material-ui/core/styles'

import { LinearGenomeViewModel, RESIZE_HANDLE_HEIGHT } from '..'
import { BaseTrackModel } from '../../BasicTrack/baseTrackModel'
import TrackLabel from './TrackLabel'

const useStyles = makeStyles(theme => ({
  root: {},
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
    zIndex: 3,
    margin: theme.spacing(1),
  },
  trackLabelInline: {
    position: 'relative',
    display: 'inline-block',
  },
  trackLabelOverlap: {
    position: 'absolute',
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
  model: LinearGenomeViewModel
  track: BaseTrackModel
}) {
  const classes = useStyles()
  const ref = useRef(null)
  const { model, track } = props
  const { horizontalScroll, draggingTrackId, moveTrack } = model
  const { height } = track
  const trackId = getConf(track, 'trackId')

  useEffect(() => {
    if (ref.current) {
      model.trackRefs[trackId] = ref.current
    }
    return () => {
      delete model.trackRefs[trackId]
    }
  }, [model.trackRefs, trackId])
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
  const view = getContainingView(track) as LinearGenomeViewModel
  const dimmed = draggingTrackId !== undefined && draggingTrackId !== track.id

  return (
    <div className={classes.root}>
      <TrackLabel
        track={track}
        className={clsx(
          classes.trackLabel,
          view.trackLabelOverlap
            ? classes.trackLabelOverlap
            : classes.trackLabelInline,
        )}
      />

      <Paper
        variant="outlined"
        className={classes.trackRenderingContainer}
        style={{ height }}
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
          ref={ref}
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
