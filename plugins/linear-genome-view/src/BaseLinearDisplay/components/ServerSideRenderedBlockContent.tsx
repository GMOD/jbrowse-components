import { Suspense, isValidElement, lazy } from 'react'

import { observer } from 'mobx-react'

import BlockMsg from './BlockMsg'
import LoadingOverlay from './LoadingOverlay'

// lazies
const BlockErrorMessage = lazy(() => import('./BlockErrorMessage'))

const ServerSideRenderedBlockContent = observer(function ({
  model,
}: {
  model: {
    error?: unknown
    reload: () => void
    message: React.ReactNode
    status?: string
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
  }
  if (model.message) {
    return isValidElement(model.message) ? (
      model.message
    ) : (
      <BlockMsg message={`${model.message}`} severity="info" />
    )
  }
  if (model.isRenderingPending) {
    return (
      <LoadingOverlay message={model.status}>
        {model.reactElement}
      </LoadingOverlay>
    )
  }
  return model.reactElement ?? null
})

export default ServerSideRenderedBlockContent
