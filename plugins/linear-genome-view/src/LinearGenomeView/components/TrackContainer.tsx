import { useRef } from 'react'

import { ErrorMessage, ResizeHandle } from '@jbrowse/core/ui'
import { ErrorBoundary } from '@jbrowse/core/ui/ErrorBoundary'
import { Paper } from '@mui/material'
import { observer } from 'mobx-react'
import { isAlive } from 'mobx-state-tree'
import { makeStyles } from 'tss-react/mui'

import Gridlines from './Gridlines'
import TrackLabelContainer from './TrackLabelContainer'
import TrackRenderingContainer from './TrackRenderingContainer'

import type { LinearGenomeViewModel } from '..'
import type { BaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'

const useStyles = makeStyles()(theme => ({
  root: {
    marginTop: 2,
    overflow: 'hidden',
    position: 'relative',
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
}))

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
  const { draggingTrackId, showTrackOutlines } = model
  const ref = useRef<HTMLDivElement>(null)

  return (
    <Paper
      ref={ref}
      className={cx(classes.root, track.pinned ? null : classes.unpinnedTrack)}
      variant={showTrackOutlines ? 'outlined' : undefined}
      elevation={showTrackOutlines ? undefined : 0}
      onClick={event => {
        if (event.detail === 2 && !track.displays[0].featureIdUnderMouse) {
          const left = ref.current?.getBoundingClientRect().left || 0
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
