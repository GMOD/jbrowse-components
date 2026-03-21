import { observer } from 'mobx-react'

import { ErrorMessage, LoadingEllipses } from '@jbrowse/core/ui'

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
        <div style={{ padding: 8, color: '#666' }}>
          <LoadingEllipses message="Loading multi-genome synteny" />
        </div>
      )
    }

    return <MultiSyntenyRendering model={model} />
  },
)

export default MultiLGVSyntenyDisplayComponent
