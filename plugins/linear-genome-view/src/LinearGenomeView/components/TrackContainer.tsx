import { useRef } from 'react'

import { ErrorMessage, ResizeHandle } from '@jbrowse/core/ui'
import { ErrorBoundary } from '@jbrowse/core/ui/ErrorBoundary'
import { cx, makeStyles } from '@jbrowse/core/util/tss-react'
import { isAlive } from '@jbrowse/mobx-state-tree'
import { Paper } from '@mui/material'
import { observer } from 'mobx-react'

import Gridlines from './Gridlines.tsx'
import SeparateTrackLabel from './SeparateTrackLabel.tsx'
import TrackLabelContainer from './TrackLabelContainer.tsx'
import TrackRenderingContainer from './TrackRenderingContainer.tsx'
import { shouldSwapTracks } from './util.ts'

import type { LinearGenomeViewModel } from '../index.ts'
import type { BaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'

const useStyles = makeStyles()(theme => ({
  root: {
    marginTop: 2,
    overflow: 'hidden',
    position: 'relative',
    contain: 'layout style paint',
  },
  unpinnedTrack: {
    background: 'none',
  },
  resizeHandle: {
    height: 4,
    boxSizing: 'border-box',
    position: 'relative',
    background: 'transparent',
    '&:hover': {
      background: theme.palette.divider,
    },
  },
  separateContent: {
    overflow: 'hidden',
  },
}))

type LGV = LinearGenomeViewModel

const TrackContainer = observer(function TrackContainer({
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
  const isSeparate = model.trackLabelsSetting === 'separate'

  return (
    <Paper
      ref={ref}
      className={cx(classes.root, track.pinned ? null : classes.unpinnedTrack)}
      variant={showTrackOutlines ? 'outlined' : undefined}
      elevation={showTrackOutlines ? undefined : 0}
      onClick={event => {
        if (event.detail === 2 && !display.featureIdUnderMouse) {
          const left = ref.current?.getBoundingClientRect().left || 0
          model.zoomTo(model.bpPerPx / 2, event.clientX - left, true)
        }
      }}
      onDragOver={event => {
        if (
          isAlive(display) &&
          draggingTrackId !== undefined &&
          draggingTrackId !== display.id
        ) {
          const draggingIdx = model.tracks.findIndex(
            t => t.id === draggingTrackId,
          )
          const targetIdx = model.tracks.findIndex(t => t.id === track.id)
          const movingDown = targetIdx > draggingIdx
          const currentY = event.clientY

          if (shouldSwapTracks(model.lastTrackDragY, currentY, movingDown)) {
            model.setLastTrackDragY(currentY)
            model.moveTrack(draggingTrackId, track.id)
          }
        }
      }}
    >
      {track.pinned ? <Gridlines model={model} offset={1} /> : null}
      {isSeparate ? (
        <>
          <SeparateTrackLabel track={track} />
          <div
            className={classes.separateContent}
            style={{ marginLeft: model.separateTrackLabelWidth }}
          >
            <ErrorBoundary
              FallbackComponent={e => <ErrorMessage error={e.error} />}
            >
              <TrackRenderingContainer model={model} track={track} />
            </ErrorBoundary>
          </div>
        </>
      ) : (
        <>
          <TrackLabelContainer track={track} view={model} />
          <ErrorBoundary
            FallbackComponent={e => <ErrorMessage error={e.error} />}
          >
            <TrackRenderingContainer model={model} track={track} />
          </ErrorBoundary>
        </>
      )}
      <ResizeHandle
        onDrag={display.resizeHeight}
        className={classes.resizeHandle}
      />
    </Paper>
  )
})

export default TrackContainer
