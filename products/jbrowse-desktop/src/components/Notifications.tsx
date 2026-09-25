import { useCallback, useState } from 'react'

import StackTraceButton from '@jbrowse/core/ui/StackTraceButton'
import CloseIcon from '@mui/icons-material/Close'
import { Alert, Button, IconButton, Snackbar } from '@mui/material'

import { NotifyContext } from './NotifyContext.ts'

import type { NotifyAction } from './NotifyContext.ts'
import type { ReactNode } from 'react'

interface Notification {
  error: unknown
  action?: NotifyAction
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notification, setNotification] = useState<Notification>()
  // `open` rather than the presence of `notification`: MUI keeps a Snackbar's
  // children mounted through the fade-out, so clearing the message on the click
  // that dismisses it drew the string "undefined" on the way out
  const [open, setOpen] = useState(false)
  const notify = useCallback((error: unknown, action?: NotifyAction) => {
    setNotification({ error, action })
    setOpen(true)
  }, [])
  const close = () => {
    setOpen(false)
  }
  const action = notification?.action
  return (
    <NotifyContext value={notify}>
      {children}
      {/* these notifications are all failures, and one that aborts a session
      launch is not something to read in six seconds: it stays until dismissed,
      with the same stack-trace dialog the in-session error surfaces offer */}
      <Snackbar
        open={open}
        onClose={(_event, reason) => {
          // clicking anywhere else must not throw away an error the user is
          // still reading (or copying out of the stack dialog)
          if (reason !== 'clickaway') {
            close()
          }
        }}
        slotProps={{
          transition: {
            onExited: () => {
              setNotification(undefined)
            },
          },
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity="error"
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
              {/* Alert draws no close button of its own once `action` is set,
              so dismissing was the Escape key or nothing */}
              <IconButton color="inherit" title="Close" onClick={close}>
                <CloseIcon />
              </IconButton>
            </>
          }
        >
          {`${notification?.error}`}
        </Alert>
      </Snackbar>
    </NotifyContext>
  )
}
