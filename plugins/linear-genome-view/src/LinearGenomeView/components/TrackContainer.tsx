import React, { useEffect, useRef } from 'react'
import { observer } from 'mobx-react'
import { isAlive } from 'mobx-state-tree'
import { BaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'
import { getConf } from '@jbrowse/core/configuration'
import { ResizeHandle } from '@jbrowse/core/ui'
import { useDebouncedCallback, getContainingView } from '@jbrowse/core/util'
import clsx from 'clsx'
import Paper from '@material-ui/core/Paper'
import { makeStyles } from '@material-ui/core/styles'

import { LinearGenomeViewModel, RESIZE_HANDLE_HEIGHT } from '..'
import TrackLabel from './TrackLabel'

const useStyles = makeStyles(theme => ({
  root: {
    margin: 2,
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
  trackLabel: {
    zIndex: 3,
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

type LGV = LinearGenomeViewModel

function TrackContainerLabel({
  model,
  view,
}: {
  model: BaseTrackModel
  view: LGV
}) {
  const classes = useStyles()
  const labelStyle =
    view.trackLabels === 'overlapping'
      ? classes.trackLabelOverlap
      : classes.trackLabelInline
  return view.trackLabels !== 'hidden' ? (
    <TrackLabel
      track={model}
      className={clsx(classes.trackLabel, labelStyle)}
    />
  ) : null
}

function TrackContainer({
  model,
  track,
}: {
  model: LinearGenomeViewModel
  track: BaseTrackModel
}) {
  const classes = useStyles()
  const display = track.displays[0]
  const { horizontalScroll, draggingTrackId, moveTrack } = model
  const { height } = display
  const trackId = getConf(track, 'trackId')
  const ref = useRef(null)

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
      isAlive(display) &&
      draggingTrackId !== display.id
    ) {
      moveTrack(draggingTrackId, track.id)
    }
  }
  const debouncedOnDragEnter = useDebouncedCallback(onDragEnter, 100)
  const { RenderingComponent, DisplayBlurb } = display
  const dimmed = draggingTrackId !== undefined && draggingTrackId !== display.id

  return (
    <Paper className={classes.root} variant="outlined">
      <div
        className={classes.trackRenderingContainer}
        style={{ height }}
        onScroll={event => {
          const target = event.target as HTMLDivElement
          display.setScrollTop(target.scrollTop)
        }}
        onDragEnter={debouncedOnDragEnter}
        data-testid={`trackRenderingContainer-${model.id}-${trackId}`}
        role="presentation"
      >
        <TrackContainerLabel model={track} view={model} />
        <div ref={ref} style={{ transform: `scaleX(${model.scaleFactor})` }}>
          <RenderingComponent
            model={display}
            onHorizontalScroll={horizontalScroll}
          />
        </div>

        {DisplayBlurb ? (
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: display.height - 20,
            }}
          >
            <DisplayBlurb model={display} />
          </div>
        ) : null}
      </div>
      <div
        className={classes.overlay}
        style={{
          height: display.height,
          background: dimmed ? 'rgba(0, 0, 0, 0.4)' : undefined,
        }}
        onDragEnter={debouncedOnDragEnter}
      />
      <ResizeHandle
        onDrag={display.resizeHeight}
        className={classes.resizeHandle}
      />
    </Paper>
  )
}

export default observer(TrackContainer)
