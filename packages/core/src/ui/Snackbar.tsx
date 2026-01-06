import { Suspense, lazy } from 'react'

import { observer } from 'mobx-react'

import type { SnackbarMessage } from './SnackbarModel.tsx'
import type { AbstractSessionModel } from '../util/index.ts'

const SnackbarContents = lazy(() => import('./SnackbarContents.tsx'))

interface SnackbarSession extends AbstractSessionModel {
  snackbarMessages: SnackbarMessage[]
  popSnackbarMessage: () => void
}

const Snackbar = observer(function Snackbar({
  session,
}: {
  session: SnackbarSession
}) {
  const { snackbarMessages } = session
  const latestMessage = snackbarMessages.at(-1)

  return latestMessage ? (
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
  ) : null
})

export default Snackbar
