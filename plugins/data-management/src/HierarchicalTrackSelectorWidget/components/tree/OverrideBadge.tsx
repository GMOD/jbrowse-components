import { getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import EditIcon from '@mui/icons-material/Edit'
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest'
import { IconButton, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import TrackSettingsChangesDialog from '../dialogs/TrackSettingsChangesDialog.tsx'

import type { HierarchicalTrackSelectorModel } from '../../model.ts'
import type { AbstractDisplayModel, TrackConfigChange } from '@jbrowse/core/util'

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
// for either reason: a per-track config edit shadowing an admin track (the
// pencil, see session.getTrackConfigChanges / updateTrackConfiguration), or a
// session-wide displayTypeDefault the user promoted (a distinct icon, so a
// global preference never reads as an individual edit of this track). Clicking
// opens a dialog listing each changed setting and its source.
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
  const changes =
    'getTrackConfigChanges' in session
      ? (session.getTrackConfigChanges as (id: string) => TrackConfigChange[])(
          trackId,
        )
      : []
  const onReset =
    'resetTrackConfiguration' in session
      ? () => {
          ;(session.resetTrackConfiguration as (id: string) => void)(trackId)
        }
      : undefined

  const displays = openDisplays(model, trackId)
  const sessionDefaults = displays.flatMap(d =>
    d.sessionDefaultChanges ? d.sessionDefaultChanges() : [],
  )
  const onClearDefaults = displays.some(d => d.clearSessionDefaults)
    ? () => {
        for (const d of displays) {
          d.clearSessionDefaults?.()
        }
      }
    : undefined

  const edited = changes.length > 0
  const affectedByDefault = sessionDefaults.length > 0
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
        onClick={() => {
          session.queueDialog(handleClose => [
            TrackSettingsChangesDialog,
            {
              changes,
              sessionDefaults,
              trackName: name,
              onReset,
              onClearDefaults,
              handleClose,
            },
          ])
        }}
      >
        {edited ? (
          <EditIcon className={classes.editIcon} />
        ) : (
          <SettingsSuggestIcon className={classes.editIcon} />
        )}
      </IconButton>
    </Tooltip>
  )
})

export default OverrideBadge
