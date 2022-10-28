import React from 'react'
import { observer } from 'mobx-react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ServerSideRenderedContent({ model }: { model: any }) {
  const { data, renderProps, renderingComponent: RenderingComponent } = model

  return model.filled ? (
    <RenderingComponent {...data} {...renderProps} />
  ) : (
    <p>Loading</p>
  )
}

export default observer(ServerSideRenderedContent)
