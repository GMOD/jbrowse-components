import { observer } from 'mobx-react'

import BlockError from './BlockError.tsx'
import BlockMessage from './BlockMessage.tsx'
import LinearSyntenyRendering from './LinearSyntenyRendering.tsx'
import LoadingMessage from './LoadingMessage.tsx'

import type { LinearSyntenyDisplayModel } from '../model.ts'

const ServerSideRenderedBlockContent = observer(
  function ServerSideRenderedBlockContent({
    model,
  }: {
    model: LinearSyntenyDisplayModel
  }) {
    if (model.error) {
      return <BlockError error={model.error} />
    } else if (model.message) {
      return <BlockMessage messageText={model.message} />
    } else if (!model.featPositions.length && !model.features) {
      return <LoadingMessage message={model.loadingStatus} />
    } else {
      return <LinearSyntenyRendering model={model} />
    }
  },
)

export default ServerSideRenderedBlockContent
