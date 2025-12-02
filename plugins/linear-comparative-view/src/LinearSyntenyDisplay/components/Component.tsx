import { observer } from 'mobx-react'

import BlockMessage from './BlockMessage'
import LinearSyntenyRendering from './LinearSyntenyRendering'
import LoadingMessage from './LoadingMessage'

import type { LinearSyntenyDisplayModel } from '../model'

const ServerSideRenderedBlockContent = observer(function ({
  model,
}: {
  model: LinearSyntenyDisplayModel
}) {
  if (model.error) {
    return <BlockMessage messageText={`${model.error}`} error />
  } else if (model.message) {
    return <BlockMessage messageText={model.message} />
  } else if (!model.features) {
    return <LoadingMessage message={model.loadingStatus} />
  } else {
    return <LinearSyntenyRendering model={model} />
  }
})

export default ServerSideRenderedBlockContent
