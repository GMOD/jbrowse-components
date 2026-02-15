import { observer } from 'mobx-react'

import BlockError from './BlockError.tsx'
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
    } else if (!model.numFeats) {
      return <LoadingMessage />
    } else {
      return <LinearSyntenyRendering model={model} />
    }
  },
)

export default ServerSideRenderedBlockContent
