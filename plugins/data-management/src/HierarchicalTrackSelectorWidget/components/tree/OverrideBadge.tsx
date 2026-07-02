import { getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import EditIcon from '@mui/icons-material/Edit'
import { IconButton, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import TrackSettingsChangesDialog from '../dialogs/TrackSettingsChangesDialog.tsx'

import type { HierarchicalTrackSelectorModel } from '../../model.ts'
import type { TrackConfigChange } from '@jbrowse/core/util'

const useStyles = makeStyles()(theme => ({
  editButton: {
    padding: 0,
  },
  editIcon: {
    fontSize: '0.9rem',
    color: theme.palette.text.secondary,
  },
}))

// shown when a track carries session-track config edits that shadow the
// admin-owned config track (see session.isTrackOverride / updateTrackConfiguration).
// Clicking it opens a dialog listing the changed settings vs their defaults.
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
  const isOverride =
    'isTrackOverride' in session &&
    (session.isTrackOverride as (id: string) => boolean)(trackId)
  const changes =
    isOverride && 'getTrackConfigChanges' in session
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
  return isOverride ? (
    <Tooltip title="Edited — click to view the changed settings">
      <IconButton
        className={classes.editButton}
        onClick={() => {
          session.queueDialog(handleClose => [
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
  ) : null
})

export default OverrideBadge
