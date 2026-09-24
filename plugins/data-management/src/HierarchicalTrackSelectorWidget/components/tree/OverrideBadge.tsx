import { lazy } from 'react'

import { getDialogHost, getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import EditIcon from '@mui/icons-material/Edit'
import { IconButton, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import type { HierarchicalTrackSelectorModel } from '../../model.ts'

const TrackSettingsChangesDialog = lazy(
  () => import('../dialogs/TrackSettingsChangesDialog.tsx'),
)

const useStyles = makeStyles()(theme => ({
  editButton: {
    padding: 0,
  },
  editIcon: {
    fontSize: '0.9rem',
    color: theme.palette.text.secondary,
  },
}))

// shown when a track's effective settings differ from its configured defaults:
// a per-track config edit shadowing an admin track (see
// session.getTrackConfigChanges / updateTrackConfiguration).
const OpenTrackBadge = observer(function OpenTrackBadge({
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

  if (changes.length === 0) {
    return null
  }
  return (
    <Tooltip title="Edited — click to view the changed settings">
      <IconButton
        className={classes.editButton}
        data-testid="track_edited_badge"
        onClick={() => {
          getDialogHost(model).queueDialog(handleClose => [
            TrackSettingsChangesDialog,
            {
              changes,
              trackName: name,
              onReset,
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

// A closed track's edits aren't on screen to act on, so only a shown track is
// badged. The gate lives out here because most rows are closed tracks.
const OverrideBadge = observer(function OverrideBadge({
  model,
  trackId,
  name,
}: {
  model: HierarchicalTrackSelectorModel
  trackId: string
  name: string
}) {
  return model.shownTrackIds.has(trackId) ? (
    <OpenTrackBadge model={model} trackId={trackId} name={name} />
  ) : null
})

export default OverrideBadge
