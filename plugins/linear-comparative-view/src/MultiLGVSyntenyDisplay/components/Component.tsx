import { ErrorMessage, LoadingOverlay } from '@jbrowse/core/ui'
import { useDebounce } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import MultiSyntenyRendering from './MultiSyntenyRendering.tsx'

import type { MultiLGVSyntenyDisplayModel } from '../model.ts'

const MultiLGVSyntenyDisplayComponent = observer(
  function MultiLGVSyntenyDisplayComponent({
    model,
  }: {
    model: MultiLGVSyntenyDisplayModel
  }) {
    const debouncedLoading = useDebounce(model.isLoading, 500)

    if (model.error) {
      return <ErrorMessage error={model.error} />
    }

    console.log('[MultiSyntenyComponent] allGenomeNames.length:', model.allGenomeNames.length, 'isLoading:', model.isLoading, 'debouncedLoading:', debouncedLoading)

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
        <LoadingOverlay
          statusMessage={model.statusMessage}
          isVisible={debouncedLoading}
        />
      </div>
    )
  },
)

export default MultiLGVSyntenyDisplayComponent
