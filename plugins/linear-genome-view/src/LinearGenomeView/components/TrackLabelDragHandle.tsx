import React from 'react'

// icons
import DragIcon from '@mui/icons-material/DragIndicator'
import { makeStyles } from 'tss-react/mui'

import type { LinearGenomeViewModel } from '..'
import type { BaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'

const useStyles = makeStyles()({
  dragHandle: {
    cursor: 'grab',
  },
  dragHandleIcon: {
    display: 'inline-block',
    verticalAlign: 'middle',
    pointerEvents: 'none',
  },
})

function TrackLabelDragHandle({
  trackId,
  view,
  track,
}: {
  trackId: string
  track: BaseTrackModel
  view: LinearGenomeViewModel
}) {
  const { classes } = useStyles()
  return (
    <span
      draggable
      className={classes.dragHandle}
      onDragStart={event => {
        const target = event.currentTarget
        if (target.parentNode) {
          const parent = target.parentNode as HTMLElement
          event.dataTransfer.setDragImage(parent, 20, 20)
          view.setDraggingTrackId(track.id)
        }
      }}
      onDragEnd={() => {
        view.setDraggingTrackId(undefined)
      }}
      data-testid={`dragHandle-${view.id}-${trackId}`}
    >
      <DragIcon className={classes.dragHandleIcon} fontSize="small" />
    </span>
  )
}

export default TrackLabelDragHandle
