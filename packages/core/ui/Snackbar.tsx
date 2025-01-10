import { Suspense, lazy } from 'react'

import { observer } from 'mobx-react'

import type { AbstractSessionModel } from '../util'
import type { SnackbarMessage } from './SnackbarModel'

const SnackbarContents = lazy(() => import('./SnackbarContents'))

interface SnackbarSession extends AbstractSessionModel {
  snackbarMessages: SnackbarMessage[]
  popSnackbarMessage: () => void
}

const Snackbar = observer(function ({ session }: { session: SnackbarSession }) {
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
