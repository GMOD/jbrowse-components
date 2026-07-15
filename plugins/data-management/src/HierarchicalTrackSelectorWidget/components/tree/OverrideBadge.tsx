import { getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import EditIcon from '@mui/icons-material/Edit'
import { IconButton, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import TrackSettingsChangesDialog from '../dialogs/TrackSettingsChangesDialog.tsx'

import type { HierarchicalTrackSelectorModel } from '../../model.ts'
import type { AbstractDisplayModel } from '@jbrowse/core/util'

const useStyles = makeStyles()(theme => ({
  editButton: {
    padding: 0,
  },
  editIcon: {
    fontSize: '0.9rem',
    color: theme.palette.text.secondary,
  },
}))

// The open displays of `trackId` in the view this selector is attached to.
// Session-default effects are read from live display models (not track config)
// so the resolution can't drift; a closed track has no display and so no badge.
interface OpenTrack {
  configuration: { trackId: string }
  displays: AbstractDisplayModel[]
}
function openDisplays(model: HierarchicalTrackSelectorModel, trackId: string) {
  const view: { tracks?: OpenTrack[] } | undefined = model.view
  const track = view?.tracks?.find(t => t.configuration.trackId === trackId)
  return track?.displays ?? []
}

// shown when a track's effective settings differ from its configured defaults,
// for either reason: a per-track config edit shadowing an admin track (see
// session.getTrackConfigChanges / updateTrackConfiguration) or a session-wide
// displayTypeDefault the user promoted. One pencil marks both; the tooltip and
// the dialog it opens name the actual source (and its reset) in words.
const OverrideBadge = observer(function OverrideBadge({
  model,
  trackId,
  name,
}: {
  model: HierarchicalTrackSelectorModel
  trackId: string
  name: string
}) {
  const { classes } = useStyles()
  const session = getSession(model)
  const { getTrackConfigChanges, resetTrackConfiguration } = session
  const changes = getTrackConfigChanges?.(trackId) ?? []
  const onReset = resetTrackConfiguration
    ? () => {
        resetTrackConfiguration(trackId)
      }
    : undefined

  const displays = openDisplays(model, trackId)
  const displayTypeDefaults = displays.flatMap(d =>
    d.displayTypeDefaultChanges ? d.displayTypeDefaultChanges() : [],
  )
  const onClearDefaults = displays.some(d => d.clearDisplayTypeDefaults)
    ? () => {
        for (const d of displays) {
          d.clearDisplayTypeDefaults?.()
        }
      }
    : undefined

  const edited = changes.length > 0
  const affectedByDefault = displayTypeDefaults.length > 0
  if (!edited && !affectedByDefault) {
    return null
  }
  // Prefer the "edited" pencil when a real per-track edit exists; otherwise the
  // track is affected only by a session default.
  const title = edited
    ? 'Edited — click to view the changed settings'
    : 'Affected by a session-wide default — click to view'
  return (
    <Tooltip title={title}>
      <IconButton
        className={classes.editButton}
        data-testid={
          edited ? 'track_edited_badge' : 'track_session_default_badge'
        }
        onClick={() => {
          session.queueDialog(handleClose => [
            TrackSettingsChangesDialog,
            {
              changes,
              displayTypeDefaults,
              trackName: name,
              onReset,
              onClearDefaults,
              handleClose,
            },
          ])
        }}
      >
        <EditIcon className={classes.editIcon} />
      </IconButton>
    </Tooltip>
  )
})

export default OverrideBadge
