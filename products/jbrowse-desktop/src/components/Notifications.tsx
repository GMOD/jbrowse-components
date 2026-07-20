import { useCallback, useState } from 'react'

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
      <Snackbar
        open={!!notification}
        autoHideDuration={6000}
        onClose={() => {
          close()
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity="error"
          onClose={() => {
            close()
          }}
          action={
            action ? (
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
            ) : undefined
          }
        >
          {`${notification?.error}`}
        </Alert>
      </Snackbar>
    </NotifyContext>
  )
}
