import { useCallback, useState } from 'react'

import StackTraceButton from '@jbrowse/core/ui/StackTraceButton'
import { Alert, Button, Snackbar } from '@mui/material'

import { NotifyContext } from './NotifyContext.ts'

import type { NotifyAction } from './NotifyContext.ts'
import type { ReactNode } from 'react'

interface Notification {
  error: unknown
  action?: NotifyAction
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notification, setNotification] = useState<Notification>()
  const notify = useCallback((error: unknown, action?: NotifyAction) => {
    setNotification({ error, action })
  }, [])
  const close = () => {
    setNotification(undefined)
  }
  const action = notification?.action
  return (
    <NotifyContext value={notify}>
      {children}
      {/* these notifications are all failures, and one that aborts a session
      launch is not something to read in six seconds: it stays until dismissed,
      with the same stack-trace dialog the in-session error surfaces offer */}
      <Snackbar
        open={!!notification}
        onClose={(_event, reason) => {
          // clicking anywhere else must not throw away an error the user is
          // still reading (or copying out of the stack dialog)
          if (reason !== 'clickaway') {
            close()
          }
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity="error"
          onClose={() => {
            close()
          }}
          action={
            <>
              {action ? (
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => {
                    action.onClick()
                    close()
                  }}
                >
                  {action.label}
                </Button>
              ) : null}
              <StackTraceButton error={notification?.error} color="inherit" />
            </>
          }
        >
          {`${notification?.error}`}
        </Alert>
      </Snackbar>
    </NotifyContext>
  )
}
