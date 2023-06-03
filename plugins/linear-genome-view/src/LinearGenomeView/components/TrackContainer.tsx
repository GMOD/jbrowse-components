import React, { useRef } from 'react'
import { Paper } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import { isAlive } from 'mobx-state-tree'
import { ErrorBoundary } from 'react-error-boundary'

// jbrowse core
import { BaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'
import { ResizeHandle, ErrorMessage } from '@jbrowse/core/ui'
import { useDebouncedCallback } from '@jbrowse/core/util'

// locals
import { LinearGenomeViewModel } from '..'
import TrackLabelContainer from './TrackLabelContainer'
import TrackRenderingContainer from './TrackRenderingContainer'

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
})

type LGV = LinearGenomeViewModel

export default observer(function TrackContainer({
  model,
  track,
}: {
  model: LGV
  track: BaseTrackModel
}) {
  const { classes } = useStyles()
  const display = track.displays[0]
  const { draggingTrackId } = model
  const ref2 = useRef<HTMLDivElement>(null)
  const dimmed = draggingTrackId !== undefined && draggingTrackId !== display.id
  const debouncedOnDragEnter = useDebouncedCallback(() => {
    if (isAlive(display) && dimmed) {
      model.moveTrack(draggingTrackId, track.id)
    }
  }, 100)

  return (
    <Paper
      ref={ref2}
      className={classes.root}
      variant="outlined"
      onClick={event => {
        if (event.detail === 2 && !track.displays[0].featureIdUnderMouse) {
          const left = ref2.current?.getBoundingClientRect().left || 0
          model.zoomTo(model.bpPerPx / 2, event.clientX - left, true)
        }
      }}
    >
      <TrackLabelContainer track={track} view={model} />
      <ErrorBoundary FallbackComponent={e => <ErrorMessage error={e.error} />}>
        <TrackRenderingContainer
          model={model}
          track={track}
          onDragEnter={debouncedOnDragEnter}
        />
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
})
