import { useEffect, useState } from 'react'

import {
  getPendingFileHandleIds,
  restorePendingFileHandles,
} from '@jbrowse/core/util/tracks'
import { Alert, Button } from '@mui/material'

export default function FileHandleRestoreBanner() {
  const [pendingCount, setPendingCount] = useState(0)
  const [restoring, setRestoring] = useState(false)

  useEffect(() => {
    const checkPending = () => {
      const ids = getPendingFileHandleIds()
      setPendingCount(ids.length)
    }
    checkPending()
    const interval = setInterval(checkPending, 1000)
    return () => {
      clearInterval(interval)
    }
  }, [])

  const handleRestore = async () => {
    setRestoring(true)
    try {
      const results = await restorePendingFileHandles()
      const successCount = results.filter(r => r.success).length
      const stillPending = getPendingFileHandleIds().length
      setPendingCount(stillPending)

      if (successCount > 0) {
        // Reload to re-render tracks with restored files
        window.location.reload()
      }
    } catch (e) {
      console.error('Error restoring file handles:', e)
    } finally {
      setRestoring(false)
    }
  }

  if (pendingCount === 0) {
    return null
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
      {pendingCount} local file{pendingCount > 1 ? 's' : ''} need
      {pendingCount === 1 ? 's' : ''} permission to be restored.
    </Alert>
  )
}
