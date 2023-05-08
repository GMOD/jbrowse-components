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
import { getContainingView, useDebouncedCallback } from '@jbrowse/core/util'

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

const TrackInnerContainer = observer(function ({
  view,
  track,
}: {
  view: LGV
  track: BaseTrackModel
}) {
  const { classes } = useStyles()
  const display = track.displays[0]
  const { draggingTrackId } = view
  const { minimized } = track
  const { height, RenderingComponent, DisplayBlurb } = display
  const trackId = getConf(track, 'trackId')
  const ref = useRef<HTMLDivElement>(null)
  const dimmed = draggingTrackId !== undefined && draggingTrackId !== display.id
  const debouncedOnDragEnter = useDebouncedCallback(() => {
    if (isAlive(display) && dimmed) {
      view.moveTrack(draggingTrackId, track.id)
    }
  }, 100)
  useEffect(() => {
    if (ref.current) {
      view.trackRefs[trackId] = ref.current
    }
    return () => {
      delete view.trackRefs[trackId]
    }
  }, [view.trackRefs, trackId])

  return (
    <div
      ref={ref}
      className={classes.trackRenderingContainer}
      style={{ height: minimized ? 20 : height }}
      onScroll={evt => display.setScrollTop(evt.currentTarget.scrollTop)}
      onDragEnter={debouncedOnDragEnter}
      data-testid={`trackRenderingContainer-${view.id}-${trackId}`}
    >
      {!minimized ? (
        <>
          <div
            className={classes.renderingComponentContainer}
            style={{ transform: `scaleX(${view.scaleFactor})` }}
          >
            <RenderingComponent
              model={display}
              onHorizontalScroll={view.horizontalScroll}
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
  )
})

const TrackOuterContainer = observer(function ({
  children,
  track,
}: {
  children: React.ReactNode
  track: BaseTrackModel
}) {
  const ref = useRef<HTMLDivElement>(null)
  const { classes } = useStyles()
  return (
    <Paper
      ref={ref}
      className={classes.root}
      variant="outlined"
      onClick={event => {
        if (event.detail === 2 && !track.displays[0].featureIdUnderMouse) {
          const left = ref.current?.getBoundingClientRect().left || 0
          const view = getContainingView(track)
          view.zoomTo(view.bpPerPx / 2, event.clientX - left, true)
        }
      }}
    >
      {children}
    </Paper>
  )
})

export default observer(function TrackContainer({
  model: view,
  track,
}: {
  model: LGV
  track: BaseTrackModel
}) {
  const { classes } = useStyles()
  const display = track.displays[0]
  const { draggingTrackId, moveTrack } = view
  const dimmed = draggingTrackId !== undefined && draggingTrackId !== display.id
  const debouncedOnDragEnter = useDebouncedCallback(() => {
    if (isAlive(display) && dimmed) {
      moveTrack(draggingTrackId, track.id)
    }
  }, 100)

  return (
    <TrackOuterContainer track={track}>
      <TrackLabelContainer track={track} view={view} />
      <ErrorBoundary
        key={track.id}
        FallbackComponent={({ error }) => <ErrorMessage error={error} />}
      >
        <TrackInnerContainer view={view} track={track} />
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
    </TrackOuterContainer>
  )
})
