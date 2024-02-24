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
import Gridlines from './Gridlines'

const useStyles = makeStyles()({
  root: {
    marginTop: 2,
    overflow: 'hidden',
    position: 'relative',
  },
  unpinnedTrack: {
    background: 'none',
  },
  resizeHandle: {
    height: 3,
    boxSizing: 'border-box',
    position: 'relative',
  },
  overlay: {
    pointerEvents: 'none',
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    // zIndex: 3,
  },
})

type LGV = LinearGenomeViewModel

const TrackContainer = observer(function ({
  model,
  track,
}: {
  model: LGV
  track: BaseTrackModel
}) {
  const { classes, cx } = useStyles()
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
      className={cx(classes.root, track.pinned ? null : classes.unpinnedTrack)}
      variant="outlined"
      onClick={event => {
        if (event.detail === 2 && !track.displays[0].featureIdUnderMouse) {
          const left = ref2.current?.getBoundingClientRect().left || 0
          model.zoomTo(model.bpPerPx / 2, event.clientX - left, true)
        }
      }}
    >
      {/* offset 1px since for left track border */}
      {track.pinned ? <Gridlines model={model} offset={1} /> : null}
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

export default TrackContainer
