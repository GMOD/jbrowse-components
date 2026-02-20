import { SanitizedHTML, ResizeHandle } from '@jbrowse/core/ui'
import { getContainingView, getSession } from '@jbrowse/core/util'
import { getTrackName } from '@jbrowse/core/util/tracks'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import CloseIcon from '@mui/icons-material/Close'
import { IconButton, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import TrackLabelDragHandle from './TrackLabelDragHandle.tsx'
import TrackLabelMenu from './TrackLabelMenu.tsx'

import type { LinearGenomeViewModel } from '../index.ts'
import type { BaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'

const useStyles = makeStyles()(theme => ({
  root: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    display: 'flex',
    zIndex: 2,
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    background: theme.palette.grey[100],
    borderRight: `1px solid ${theme.palette.divider}`,
    overflow: 'hidden',
    ...((theme.palette.mode === 'dark'
      ? { background: theme.palette.grey[800] }
      : {}) as {}),
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottom: `1px solid ${theme.palette.divider}`,
    padding: '2px 0',
  },
  trackName: {
    fontSize: '0.75rem',
    lineHeight: 1.3,
    textAlign: 'center',
    wordBreak: 'break-word',
    padding: '4px 6px',
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButton: {
    padding: 2,
  },
  resizeHandle: {
    width: 4,
    background: 'transparent',
    flexShrink: 0,
    '&:hover': {
      background: theme.palette.grey[400],
    },
  },
}))

const SeparateTrackLabel = observer(function SeparateTrackLabel({
  track,
}: {
  track: BaseTrackModel
}) {
  const { classes } = useStyles()
  const view = getContainingView(track) as LinearGenomeViewModel
  const session = getSession(track)
  const trackName = getTrackName(track.configuration, session)
  const { minimized, trackId } = track

  return (
    <div
      className={classes.root}
      style={{ width: view.separateTrackLabelWidth }}
      onClick={e => e.stopPropagation()}
    >
      <div className={classes.label}>
        <div className={classes.controls}>
          <TrackLabelDragHandle track={track} trackId={trackId} view={view} />
          <IconButton
            onClick={() => view.hideTrack(trackId)}
            className={classes.iconButton}
            title="close this track"
          >
            <CloseIcon sx={{ fontSize: '1rem' }} />
          </IconButton>
          <TrackLabelMenu track={track} />
        </div>
        <Typography
          variant="body1"
          component="div"
          className={classes.trackName}
        >
          <SanitizedHTML
            html={[trackName, minimized ? '(minimized)' : '']
              .filter(f => !!f)
              .join(' ')}
          />
        </Typography>
      </div>
      <ResizeHandle
        vertical
        flexbox
        onDrag={dist => {
          view.setSeparateTrackLabelWidth(
            view.separateTrackLabelWidth + dist,
          )
          return view.separateTrackLabelWidth
        }}
        className={classes.resizeHandle}
      />
    </div>
  )
})

export default SeparateTrackLabel
