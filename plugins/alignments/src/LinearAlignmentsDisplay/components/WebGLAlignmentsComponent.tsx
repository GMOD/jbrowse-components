import { TooLargeMessage } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import BlockMsg from './BlockMsg.tsx'
import WebGLPileupComponent from './WebGLPileupComponent.tsx'

import type { LinearAlignmentsDisplayModel } from './useAlignmentsBase.ts'

const WebGLAlignmentsComponent = observer(function WebGLAlignmentsComponent({
  model,
}: {
  model: LinearAlignmentsDisplayModel
}) {
  const { error, regionTooLarge, height } = model

  if (error || regionTooLarge) {
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

  return <WebGLPileupComponent model={model} />
})

export default WebGLAlignmentsComponent
