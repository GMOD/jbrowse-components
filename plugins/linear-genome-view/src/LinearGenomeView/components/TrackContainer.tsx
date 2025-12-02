import { useRef } from 'react'

import { ErrorMessage, ResizeHandle } from '@jbrowse/core/ui'
import { ErrorBoundary } from '@jbrowse/core/ui/ErrorBoundary'
import { cx, makeStyles } from '@jbrowse/core/util/tss-react'
import { isAlive } from '@jbrowse/mobx-state-tree'
import { Paper } from '@mui/material'
import { observer } from 'mobx-react'

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
}))

type LGV = LinearGenomeViewModel

let lastSwapY: number | undefined
let lastDraggingTrackId: string | undefined

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
          onDragOver={event => {
            if (
              isAlive(display) &&
              draggingTrackId !== undefined &&
              draggingTrackId !== display.id
            ) {
              // reset state when a new drag starts
              if (lastDraggingTrackId !== draggingTrackId) {
                lastDraggingTrackId = draggingTrackId
                lastSwapY = undefined
              }

              const draggingIdx = model.tracks.findIndex(
                t => t.id === draggingTrackId,
              )
              const targetIdx = model.tracks.findIndex(t => t.id === track.id)
              const movingDown = targetIdx > draggingIdx
              const currentY = event.clientY
              const minDistance = 30

              // allow swap if: first swap, or mouse moved enough in swap direction
              const shouldSwap =
                lastSwapY === undefined ||
                (movingDown && currentY > lastSwapY + minDistance) ||
                (!movingDown && currentY < lastSwapY - minDistance)

              if (shouldSwap) {
                lastSwapY = currentY
                model.moveTrack(draggingTrackId, track.id)
              }
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
