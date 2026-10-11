import { useState } from 'react'

import { ConfirmDialog } from '@jbrowse/core/ui'
import { MenuItem, TextField, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { STALE_CUTOFFS, staleSessions } from './util.ts'

import type { SessionModel } from './util.ts'

/**
 * Confirmation for the bulk "delete old sessions" action, which is the one
 * control here that can destroy many sessions at once and was previously a
 * single unconfirmed click. Shows how many sessions the chosen cutoff actually
 * matches, so "delete" is never a guess.
 */
const DeleteOldSessionsDialog = observer(function DeleteOldSessionsDialog({
  session,
  onClose,
}: {
  session: SessionModel
  onClose: () => void
}) {
  const [days, setDays] = useState<number>(STALE_CUTOFFS[0].days)
  const matched = staleSessions(session.savedSessionMetadata, {
    days,
    openSessionId: session.id,
  })
  return (
    <ConfirmDialog
      open
      title="Delete old sessions"
      submitText="Delete"
      submitColor="error"
      submitDisabled={matched.length === 0}
      onCancel={onClose}
      onSubmit={() => {
        session
          .deleteSavedSessions(matched.map(m => m.id))
          .then(() => {
            session.notify(
              `${matched.length} session${matched.length === 1 ? '' : 's'} deleted`,
              'success',
            )
          })
          .catch((e: unknown) => {
            console.error(e)
            session.notifyError(`${e}`, e)
          })
        onClose()
      }}
    >
      <TextField
        select
        fullWidth
        label="Delete sessions last used more than"
        value={days}
        onChange={event => {
          setDays(+event.target.value)
        }}
      >
        {STALE_CUTOFFS.map(cutoff => (
          <MenuItem key={cutoff.days} value={cutoff.days}>
            {cutoff.label} ago
          </MenuItem>
        ))}
      </TextField>
      <Typography>
        {matched.length === 0
          ? 'No sessions match — favorites and the session you have open are never deleted.'
          : `${matched.length} session${matched.length === 1 ? '' : 's'} will be deleted. Favorites and the session you have open are kept.`}
      </Typography>
    </ConfirmDialog>
  )
})

export default DeleteOldSessionsDialog
