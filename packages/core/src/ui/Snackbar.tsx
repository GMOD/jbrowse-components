import { Suspense, lazy } from 'react'

import { observer } from 'mobx-react'

import type { ErrorDialogState, SnackbarMessage } from './SnackbarModel.tsx'
import type { AbstractSessionModel } from '../util/index.ts'

const SnackbarContents = lazy(() => import('./SnackbarContents.tsx'))
const ErrorMessageStackTraceDialog = lazy(
  () => import('./ErrorMessageStackTraceDialog.tsx'),
)

interface SnackbarSession extends AbstractSessionModel {
  snackbarMessages: SnackbarMessage[]
  popSnackbarMessage: () => void
  errorDialog: ErrorDialogState | undefined
  setErrorDialog: (state: ErrorDialogState | undefined) => void
}

const Snackbar = observer(function Snackbar({
  session,
}: {
  session: SnackbarSession
}) {
  const { snackbarMessages, errorDialog } = session
  const latestMessage = snackbarMessages.at(-1)

  return (
    <>
      {latestMessage ? (
        <Suspense fallback={null}>
          <SnackbarContents
            onClose={(_event, reason) => {
              if (reason !== 'clickaway') {
                session.popSnackbarMessage()
              }
            }}
            contents={latestMessage}
          />
        </Suspense>
      ) : null}
      {errorDialog ? (
        <Suspense fallback={null}>
          <ErrorMessageStackTraceDialog
            error={errorDialog.error}
            extra={errorDialog.extra}
            onClose={() => {
              session.setErrorDialog(undefined)
            }}
          />
        </Suspense>
      ) : null}
    </>
  )
})

export default Snackbar
