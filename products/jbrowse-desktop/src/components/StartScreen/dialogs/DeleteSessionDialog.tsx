import { ErrorMessage } from '@jbrowse/core/ui'
import ConfirmDialog from '@jbrowse/core/ui/ConfirmDialog'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { DialogContentText } from '@mui/material'

import { invokeIpc } from '../../../ipc.ts'
import { useIpcAction } from './useIpcAction.ts'

import type { RecentSessionData } from '../types.ts'

// long enough to see what a normal selection holds, short enough that "delete
// every autosave older than 30 days" doesn't turn into a wall of paths
const MAX_LISTED = 8

const useStyles = makeStyles()(theme => ({
  paths: {
    margin: `${theme.spacing(1)} 0`,
    paddingLeft: theme.spacing(3),
    maxHeight: 200,
    overflow: 'auto',
  },
  path: {
    // an absolute path has no spaces to break on, and a dialog that widens to
    // fit one pushes the buttons off screen
    overflowWrap: 'anywhere',
  },
}))

export default function DeleteSessionDialog({
  sessionsToDelete,
  onClose,
}: {
  sessionsToDelete: RecentSessionData[]
  onClose: () => void
}) {
  const { classes } = useStyles()
  const count = sessionsToDelete.length
  const { error, pending, onSubmit } = useIpcAction(
    () =>
      invokeIpc(
        'deleteSessions',
        sessionsToDelete.map(s => s.path),
      ),
    onClose,
  )
  // This removes the session files, not just their rows, and the two kinds of
  // row are not the same stakes: an autosave is a file in a directory the app
  // owns, named after a timestamp, while a saved session is a file where the
  // user put it. Naming the second kind is the whole reason to confirm at all —
  // "Delete" under "Recently opened sessions" otherwise reads as "remove from
  // this list", which is a different action (and one the app does have).
  const saved = sessionsToDelete.filter(s => !s.isAutosave)

  return (
    <ConfirmDialog
      open
      maxWidth="sm"
      fullWidth
      title={`Delete ${count} ${count === 1 ? 'session' : 'sessions'}?`}
      submitDisabled={pending}
      onSubmit={onSubmit}
      onCancel={onClose}
    >
      {saved.length ? (
        <>
          <DialogContentText>
            {saved.length === 1
              ? 'This deletes the session file itself, not just its entry in the list:'
              : 'This deletes the session files themselves, not just their entries in the list:'}
          </DialogContentText>
          <ul className={classes.paths}>
            {saved.slice(0, MAX_LISTED).map(session => (
              <li key={session.path}>
                <DialogContentText className={classes.path}>
                  {session.path}
                </DialogContentText>
              </li>
            ))}
          </ul>
          {saved.length > MAX_LISTED ? (
            <DialogContentText>
              ...and {saved.length - MAX_LISTED} more
            </DialogContentText>
          ) : null}
        </>
      ) : (
        <DialogContentText>
          {count === 1
            ? 'This deletes the autosave file itself, not just its entry in the list.'
            : 'This deletes the autosave files themselves, not just their entries in the list.'}
        </DialogContentText>
      )}
      <DialogContentText>This action cannot be undone</DialogContentText>
      {error ? <ErrorMessage error={error} /> : null}
    </ConfirmDialog>
  )
}
