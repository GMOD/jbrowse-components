import { Suspense } from 'react'

import { observer } from 'mobx-react'

import type { LinearReferenceSequenceDisplayModel } from '../model.ts'

const SequenceDisplayComponent = observer(function SequenceDisplayComponent({
  model,
}: {
  model: LinearReferenceSequenceDisplayModel
}) {
  const { DisplayMessageComponent, height } = model
  return (
    <div
      style={{
        position: 'relative',
        whiteSpace: 'nowrap',
        textAlign: 'left',
        width: '100%',
        minHeight: height,
      }}
    >
      <Suspense fallback={null}>
        <DisplayMessageComponent model={model} />
      </Suspense>
    </div>
  )
})

export default SequenceDisplayComponent
