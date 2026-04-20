import { ErrorMessage, LoadingOverlay } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

import MultiSyntenyRendering from './MultiSyntenyRendering.tsx'

import type { MultiLGVSyntenyDisplayModel } from '../model.ts'

const MultiLGVSyntenyDisplayComponent = observer(
  function MultiLGVSyntenyDisplayComponent({
    model,
  }: {
    model: MultiLGVSyntenyDisplayModel
  }) {
    if (model.error) {
      return <ErrorMessage error={model.error} />
    }

    if (model.allGenomeNames.length === 0) {
      return (
        <div style={{ position: 'relative', height: model.height }}>
          <LoadingOverlay statusMessage={model.statusMessage} isVisible />
        </div>
      )
    }

    return (
      <div style={{ position: 'relative' }}>
        <MultiSyntenyRendering model={model} />
        <SyntenyLoadingOverlay model={model} />
      </div>
    )
  },
)

const SyntenyLoadingOverlay = observer(function SyntenyLoadingOverlay({
  model,
}: {
  model: Pick<MultiLGVSyntenyDisplayModel, 'isLoading' | 'statusMessage'>
}) {
  return (
    <LoadingOverlay statusMessage={model.statusMessage} isVisible={model.isLoading} />
  )
})

export default MultiLGVSyntenyDisplayComponent
