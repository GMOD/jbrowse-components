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

type LGV = LinearGenomeViewModel

function TrackContainer(props: {
  model: LinearGenomeViewModel
  track: BaseTrackModel
}) {
  const classes = useStyles()
  const { model, track } = props
  const display = track.displays[0]
  const { horizontalScroll, draggingTrackId, moveTrack } = model
  const { height } = display
  const view = getContainingView(display) as LGV
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
    <div className={classes.root}>
      {view.trackLabels !== 'hidden' ? (
        <TrackLabel
          track={track}
          className={clsx(
            classes.trackLabel,
            view.trackLabels === 'overlapping'
              ? classes.trackLabelOverlap
              : classes.trackLabelInline,
          )}
        />
      ) : null}

      <Paper
        variant="outlined"
        className={classes.trackRenderingContainer}
        style={{ height }}
        onScroll={event => {
          const target = event.target as HTMLDivElement
          display.setScrollTop(target.scrollTop)
        }}
        onDragEnter={debouncedOnDragEnter}
        data-testid={`trackRenderingContainer-${view.id}-${trackId}`}
        role="presentation"
      >
        <div
          ref={ref}
          className={classes.renderingComponentContainer}
          style={{ transform: `scaleX(${model.scaleFactor})` }}
        >
          <RenderingComponent
            model={display}
            blockState={{}}
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
            {' '}
            <DisplayBlurb model={display} />
          </div>
        ) : null}
      </Paper>
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
    </div>
  )
}

export default observer(TrackContainer)
