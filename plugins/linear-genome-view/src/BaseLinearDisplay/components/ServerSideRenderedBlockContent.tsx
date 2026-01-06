import { Suspense, isValidElement, lazy } from 'react'

import { observer } from 'mobx-react'

import BlockMsg from './BlockMsg.tsx'
import LoadingOverlay from './LoadingOverlay.tsx'

const BlockErrorMessage = lazy(() => import('./BlockErrorMessage.tsx'))

const ServerSideRenderedBlockContent = observer(
  function ServerSideRenderedBlockContent({
    model,
  }: {
    model: {
      error?: unknown
      reload: () => void
      message?: React.ReactNode
      statusMessage?: string
      reactElement?: React.ReactElement
      isRenderingPending?: boolean
    }
  }) {
    if (model.error) {
      return (
        <Suspense fallback={null}>
          <BlockErrorMessage model={model} />
        </Suspense>
      )
    } else if (model.message) {
      return isValidElement(model.message) ? (
        model.message
      ) : (
        <BlockMsg message={`${model.message}`} severity="info" />
      )
    } else {
      return (
        <LoadingOverlay statusMessage={model.statusMessage}>
          {model.reactElement}
        </LoadingOverlay>
      )
    }
  },
)

export default ServerSideRenderedBlockContent
