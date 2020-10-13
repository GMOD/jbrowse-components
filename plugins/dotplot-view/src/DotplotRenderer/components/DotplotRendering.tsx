import { PrerenderedCanvas } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'
import React from 'react'
import { DotplotRenderProps } from '../DotplotRenderer'

function DotplotRendering(props: DotplotRenderProps) {
  return <PrerenderedCanvas {...props} />
}

export default observer(DotplotRendering)
