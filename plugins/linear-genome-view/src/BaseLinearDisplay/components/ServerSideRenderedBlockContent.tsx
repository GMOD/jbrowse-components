import { Suspense, isValidElement, lazy } from 'react'

import { observer } from 'mobx-react'

import BlockLoadingMessage from './BlockLoadingMessage'
import BlockMsg from './BlockMsg'

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
  } else if (!model.filled) {
    return <BlockLoadingMessage model={model} />
  } else {
    return model.reactElement
  }
})

export default ServerSideRenderedBlockContent
