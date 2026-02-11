import {
  TooLargeMessage,
} from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import BlockMsg from './BlockMsg.tsx'
import WebGLArcsComponent from './WebGLArcsComponent.tsx'
import WebGLChainComponent from './WebGLChainComponent.tsx'
import WebGLPileupComponent from './WebGLPileupComponent.tsx'

import type { LinearAlignmentsDisplayModel } from './useAlignmentsBase.ts'

const WebGLAlignmentsComponent = observer(function WebGLAlignmentsComponent({
  model,
}: {
  model: LinearAlignmentsDisplayModel
}) {
  const { renderingMode, error, regionTooLarge, height } = model

  if (error || regionTooLarge) {
    model.setFeatureIdUnderMouse(undefined)
    model.setMouseoverExtraInformation(undefined)
    return (
      <div style={{ position: 'relative', width: '100%', height }}>
        {error ? (
          <BlockMsg severity="error" message={error.message} />
        ) : (
          <TooLargeMessage model={model} />
        )}
      </div>
    )
  }

  if (renderingMode === 'arcs') {
    return <WebGLArcsComponent model={model} />
  }
  if (renderingMode === 'cloud' || renderingMode === 'linkedRead') {
    return <WebGLChainComponent model={model} />
  }
  return <WebGLPileupComponent model={model} />
})

export default WebGLAlignmentsComponent
