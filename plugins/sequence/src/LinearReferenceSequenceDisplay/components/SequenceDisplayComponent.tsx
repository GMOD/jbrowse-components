import { Suspense } from 'react'

import { observer } from 'mobx-react'

import { WebGLSequenceComponent } from '../model.ts'

import type { LinearReferenceSequenceDisplayModel } from '../model.ts'

const SequenceDisplayComponent = observer(function SequenceDisplayComponent({
  model,
}: {
  model: LinearReferenceSequenceDisplayModel
}) {
  return (
    <div
      style={{
        position: 'relative',
        whiteSpace: 'nowrap',
        textAlign: 'left',
        width: '100%',
        minHeight: model.height,
      }}
    >
      <Suspense fallback={null}>
        <WebGLSequenceComponent model={model} />
      </Suspense>
    </div>
  )
})

export default SequenceDisplayComponent
