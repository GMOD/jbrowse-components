import { ErrorMessage } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

import LinearSyntenyRendering from './LinearSyntenyRendering.tsx'

import type { LinearSyntenyDisplayModel } from '../model.ts'

const ServerSideRenderedBlockContent = observer(
  function ServerSideRenderedBlockContent({
    model,
  }: {
    model: LinearSyntenyDisplayModel
  }) {
    if (model.error) {
      return <ErrorMessage error={model.error} />
    }
    return <LinearSyntenyRendering model={model} />
  },
)

export default ServerSideRenderedBlockContent
