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
    filled?: boolean
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
  } else if (model.message) {
    // the message can be a fully rendered react component, e.g. the region too
    // large message
    return isValidElement(model.message) ? (
      model.message
    ) : (
      <BlockMsg message={`${model.message}`} severity="info" />
    )
  } else if (
    model.isRenderingPending ||
    (!model.filled && !model.reactElement)
  ) {
    // Render is in flight, or we have no content and not filled yet
    // Show old content with overlay if available, otherwise show just overlay
    return (
      <LoadingOverlay message={model.status}>
        {model.reactElement}
      </LoadingOverlay>
    )
  } else if (model.filled) {
    // Render completed - show new content without overlay
    return model.reactElement
  } else {
    // No content and not rendering - show nothing
    return null
  }
})

export default ServerSideRenderedBlockContent
