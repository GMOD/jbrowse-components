import { ErrorBanner, ResizeHandle } from '@jbrowse/core/ui'
import { ErrorBoundary } from '@jbrowse/core/ui/ErrorBoundary'
import { cx, makeStyles } from '@jbrowse/core/util/tss-react'
import { Paper } from '@mui/material'
import { observer } from 'mobx-react'

import Gridlines from './Gridlines.tsx'
import PaddingBlocks from './PaddingBlocks.tsx'
import TrackLabel from './TrackLabel.tsx'
import TrackRenderingContainer from './TrackRenderingContainer.tsx'

import type { LinearGenomeViewModel } from '../index.ts'
import type { BaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'

const useStyles = makeStyles()({
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
    position: 'relative',
    height: 4,
  },
  trackLabel: {},
  trackLabelOffset: {
    position: 'relative',
    display: 'inline-block',
  },
  trackLabelOverlap: {
    position: 'absolute',
  },
})

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
  const { showTrackOutlines } = model
  const trackLabelStyle =
    model.trackLabels !== 'overlapping' || display.prefersOffset
      ? classes.trackLabelOffset
      : classes.trackLabelOverlap

  return (
    <Paper
      className={cx(classes.root, track.pinned ? null : classes.unpinnedTrack)}
      variant={showTrackOutlines ? 'outlined' : undefined}
      elevation={showTrackOutlines ? undefined : 0}
      onDragOver={event => {
        model.onTrackDragOver(track.id, event.clientY)
      }}
    >
      {/* offset cancels the Paper's 1px left border (present iff outlines on) */}
      {track.pinned ? (
        <Gridlines model={model} offset={showTrackOutlines ? 1 : 0} />
      ) : null}
      {model.trackLabels !== 'hidden' ? (
        <TrackLabel
          track={track}
          className={cx(classes.trackLabel, trackLabelStyle)}
        />
      ) : null}
      <ErrorBoundary FallbackComponent={e => <ErrorBanner error={e.error} />}>
        <TrackRenderingContainer model={model} track={track} />
      </ErrorBoundary>
      {/* mirrors the rendering container's left offset (both sit inside the
          Paper's 1px border, present iff outlines on), so the separator masks
          the track content at the same x the data is drawn */}
      <PaddingBlocks model={model} offset={showTrackOutlines ? 1 : 0} />
      <ResizeHandle
        onDrag={distance => display.resizeHeight(distance)}
        className={classes.resizeHandle}
      />
    </Paper>
  )
})

export default TrackContainer
