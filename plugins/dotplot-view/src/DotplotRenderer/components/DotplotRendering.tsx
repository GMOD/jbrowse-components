import React from 'react'
import { PrerenderedCanvas } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

// locals
import { DotplotRenderArgsDeserialized } from '../DotplotRenderer'

function DotplotRendering(props: DotplotRenderArgsDeserialized) {
  console.log({ props })
  return <PrerenderedCanvas {...props} />
}

export default observer(DotplotRendering)
