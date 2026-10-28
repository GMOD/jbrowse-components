import { useCallback, useState } from 'react'

import StackTraceButton from '@jbrowse/core/ui/StackTraceButton'
import CloseIcon from '@mui/icons-material/Close'
import { Alert, Button, IconButton, Snackbar } from '@mui/material'
import { observer } from 'mobx-react'

import { NotifyContext } from './NotifyContext.ts'

import type { NotifyAction } from './NotifyContext.ts'
import type { ReactNode } from 'react'

interface Notification {
  error: unknown
  action?: NotifyAction
}

export const NotificationProvider = observer(function NotificationProvider({
  children,
}: {
  children: ReactNode
}) {
  // Queued, so two failures raised together (several global plugins failing
  // offline) are each seen in turn rather than the last replacing the rest.
  // The shown one leaves the queue only once its fade-out ends: MUI keeps a
  // Snackbar's children mounted until then, and dropping it on the dismissing
  // click drew the next message, or "undefined", on the way out.
  const [queue, setQueue] = useState<Notification[]>([])
  const [closing, setClosing] = useState(false)
  const notify = useCallback((error: unknown, action?: NotifyAction) => {
    setQueue(q => [...q, { error, action }])
  }, [])
  const close = () => {
    setClosing(true)
  }
  const notification = queue[0]
  const open = !!notification && !closing
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
              setQueue(q => q.slice(1))
              setClosing(false)
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
})
