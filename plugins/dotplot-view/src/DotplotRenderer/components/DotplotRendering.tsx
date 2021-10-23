import { PrerenderedCanvas } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'
import React from 'react'
import { RenderArgsDeserialized } from '../DotplotRenderer'

function DotplotRendering(props: RenderArgsDeserialized) {
  return <PrerenderedCanvas {...props} />
}

export default observer(DotplotRendering)
