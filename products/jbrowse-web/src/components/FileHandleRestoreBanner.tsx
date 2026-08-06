import { useState } from 'react'

import { Alert, Button } from '@mui/material'
import { observer } from 'mobx-react'

import { reloadPage } from '../util.ts'

import type { WebSessionModel } from '../sessionModel/index.ts'

const FileHandleRestoreBanner = observer(function FileHandleRestoreBanner({
  session,
}: {
  session: WebSessionModel
}) {
  const [restoring, setRestoring] = useState(false)
  const count = session.pendingFileHandleIds.length

  if (count === 0) {
    return null
  }

  const handleRestore = async () => {
    setRestoring(true)
    try {
      await session.restorePendingFileHandles()
      if (session.pendingFileHandleIds.length < count) {
        reloadPage()
      } else {
        // restoreFileHandles settles each handle rather than throwing, so a
        // denied (or dismissed) permission prompt comes back as "still
        // pending" — indistinguishable from the click doing nothing at all
        // unless it is said out loud
        session.notify(
          'No file access was granted, so nothing was restored',
          'warning',
        )
      }
    } catch (e) {
      console.error(e)
      session.notifyError(`${e}`, e)
    } finally {
      setRestoring(false)
    }
  }

  return (
    <Alert
      severity="warning"
      action={
        <Button
          color="inherit"
          size="small"
          onClick={() => {
            void handleRestore()
          }}
          disabled={restoring}
        >
          {restoring ? 'Restoring...' : 'Restore access'}
        </Button>
      }
    >
      {count} local file{count > 1 ? 's' : ''} need{count === 1 ? 's' : ''}{' '}
      permission to be restored.
    </Alert>
  )
})

export default FileHandleRestoreBanner
