import React, { useRef } from 'react'
import { Paper } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import { isAlive } from 'mobx-state-tree'
import { ErrorBoundary } from '@jbrowse/core/ui/ErrorBoundary'

// jbrowse core
import { BaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'
import { ResizeHandle, ErrorMessage } from '@jbrowse/core/ui'

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
})

type LGV = LinearGenomeViewModel

const TrackContainer = observer(function ({
  model,
  track,
}: {
  model: LGV
  track: BaseTrackModel
}) {
  const { classes } = useStyles()
  const display = track.displays[0]
  const { draggingTrackId, showTrackOutlines } = model
  const ref = useRef<HTMLDivElement>(null)

  return (
    <Paper
      ref={ref}
      className={classes.root}
      variant={showTrackOutlines ? 'outlined' : undefined}
      elevation={showTrackOutlines ? undefined : 0}
      onClick={event => {
        if (event.detail === 2 && !track.displays[0].featureIdUnderMouse) {
          const left = ref.current?.getBoundingClientRect().left || 0
          model.zoomTo(model.bpPerPx / 2, event.clientX - left, true)
        }
      }}
    >
      <TrackLabelContainer track={track} view={model} />
      <ErrorBoundary FallbackComponent={e => <ErrorMessage error={e.error} />}>
        <TrackRenderingContainer
          model={model}
          track={track}
          onDragEnter={() => {
            if (
              isAlive(display) &&
              draggingTrackId !== undefined &&
              draggingTrackId !== display.id
            ) {
              model.moveTrack(draggingTrackId, track.id)
            }
          }}
        />
      </ErrorBoundary>
      <ResizeHandle
        onDrag={display.resizeHeight}
        className={classes.resizeHandle}
      />
    </Paper>
  )
})

export default TrackContainer
