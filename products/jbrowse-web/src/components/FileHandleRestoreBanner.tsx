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
  const { pendingFileHandleIds } = session

  if (pendingFileHandleIds.length === 0) {
    return null
  }

  const count = pendingFileHandleIds.length

  const handleRestore = async () => {
    setRestoring(true)
    try {
      const before = count
      await session.restorePendingFileHandles()
      if (session.pendingFileHandleIds.length < before) {
        reloadPage()
      }
    } catch (e) {
      console.error('Error restoring file handles:', e)
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
          onClick={handleRestore}
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
