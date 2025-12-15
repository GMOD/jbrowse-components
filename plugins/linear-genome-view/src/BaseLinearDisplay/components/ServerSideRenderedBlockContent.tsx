import { Suspense, lazy } from 'react'

import { observer } from 'mobx-react'

import LoadingOverlay from './LoadingOverlay'

const BlockErrorMessage = lazy(() => import('./BlockErrorMessage'))

const ServerSideRenderedBlockContent = observer(function ({
  model,
}: {
  model: {
    error?: unknown
    reload: () => void
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
  } else if (model.statusMessage) {
    return (
      <LoadingOverlay statusMessage={model.statusMessage}>
        {model.reactElement}
      </LoadingOverlay>
    )
  } else {
    return model.reactElement ?? null
  }
})

export default ServerSideRenderedBlockContent
