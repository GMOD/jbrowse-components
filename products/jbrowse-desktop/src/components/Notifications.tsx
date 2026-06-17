import { useState } from 'react'
import type { ReactNode } from 'react'

import { Alert, Snackbar } from '@mui/material'

import { NotifyContext } from './NotifyContext.ts'

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [error, setError] = useState<unknown>()
  return (
    <NotifyContext value={setError}>
      {children}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => {
          setError(undefined)
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity="error"
          onClose={() => {
            setError(undefined)
          }}
        >
          {`${error}`}
        </Alert>
      </Snackbar>
    </NotifyContext>
  )
}
