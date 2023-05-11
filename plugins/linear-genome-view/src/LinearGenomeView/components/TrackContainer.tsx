import React, { useEffect, useRef } from 'react'
import { Paper } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import { isAlive } from 'mobx-state-tree'
import { ErrorBoundary } from 'react-error-boundary'

// jbrowse core
import { BaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'
import { getConf } from '@jbrowse/core/configuration'
import { ResizeHandle, ErrorMessage } from '@jbrowse/core/ui'
import { useDebouncedCallback } from '@jbrowse/core/util'

// locals
import { LinearGenomeViewModel } from '..'
import TrackLabelContainer from './TrackLabelContainer'

const useStyles = makeStyles()({
  root: {
    marginTop: 2,
  },
  resizeHandle: {
    height: 3,
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
  },

  // aligns with block boundaries. check for example the breakpoint split view
  // demo to see if features align if wanting to change things
  renderingComponentContainer: {
    position: 'absolute',
    // -1 offset because of the 1px border of the Paper
    left: -1,
    height: '100%',
    width: '100%',
  },

  trackRenderingContainer: {
    overflowY: 'auto',
    overflowX: 'hidden',
    whiteSpace: 'nowrap',
    position: 'relative',
    background: 'none',
    zIndex: 2,
  },
})

type LGV = LinearGenomeViewModel

function TrackContainer({
  model,
  track,
}: {
  model: LGV
  track: BaseTrackModel
}) {
  const { classes } = useStyles()
  const display = track.displays[0]
  const { horizontalScroll, draggingTrackId, moveTrack } = model
  const { height, RenderingComponent, DisplayBlurb } = display
  const trackId = getConf(track, 'trackId')
  const ref = useRef<HTMLDivElement>(null)
  const dimmed = draggingTrackId !== undefined && draggingTrackId !== display.id
  const minimized = track.minimized
  const debouncedOnDragEnter = useDebouncedCallback(() => {
    if (isAlive(display) && dimmed) {
      moveTrack(draggingTrackId, track.id)
    }
  }, 100)
  useEffect(() => {
    if (ref.current) {
      model.trackRefs[trackId] = ref.current
    }
    return () => {
      delete model.trackRefs[trackId]
    }
  }, [model.trackRefs, trackId])

  return (
    <Paper
      ref={ref}
      className={classes.root}
      variant="outlined"
      onClick={event => {
        if (event.detail === 2 && !track.displays[0].featureIdUnderMouse) {
          const left = ref.current?.getBoundingClientRect().left || 0
          model.zoomTo(model.bpPerPx / 2, event.clientX - left, true)
        }
      }}
    >
      <TrackLabelContainer track={track} view={model} />
      <ErrorBoundary
        key={track.id}
        FallbackComponent={({ error }) => <ErrorMessage error={error} />}
      >
        <div
          className={classes.trackRenderingContainer}
          style={{ height: minimized ? 20 : height }}
          onScroll={evt => display.setScrollTop(evt.currentTarget.scrollTop)}
          onDragEnter={debouncedOnDragEnter}
          data-testid={`trackRenderingContainer-${model.id}-${trackId}`}
        >
          {!minimized ? (
            <>
              <div
                className={classes.renderingComponentContainer}
                style={{ transform: `scaleX(${model.scaleFactor})` }}
              >
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
            </>
          ) : null}
        </div>
      </ErrorBoundary>
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
