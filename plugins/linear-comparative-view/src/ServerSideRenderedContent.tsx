import React from 'react'
import { observer } from 'mobx-react'
import { LoadingEllipses } from '@jbrowse/core/ui'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ServerSideRenderedContent({ model }: { model: any }) {
  const { data, renderProps, renderingComponent: RenderingComponent } = model

  return model.filled ? (
    <RenderingComponent {...data} {...renderProps} />
  ) : (
    <LoadingEllipses />
  )
}

export default observer(ServerSideRenderedContent)
