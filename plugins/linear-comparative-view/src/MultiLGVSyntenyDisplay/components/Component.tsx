import { observer } from 'mobx-react'

import { getContainingView } from '@jbrowse/core/util'
import { ErrorMessage, LoadingEllipses } from '@jbrowse/core/ui'

import MultiSyntenyRendering from './MultiSyntenyRendering.tsx'

import type { MultiLGVSyntenyDisplayModel } from '../model.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const MultiLGVSyntenyDisplayComponent = observer(
  function MultiLGVSyntenyDisplayComponent({
    model,
  }: {
    model: MultiLGVSyntenyDisplayModel
  }) {
    const view = getContainingView(model) as LinearGenomeViewModel

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

    return (
      <MultiSyntenyRendering
        genomeRows={model.genomeRows}
        displayedGenomes={model.displayedGenomes}
        width={view.width}
        rowHeight={model.rowHeight}
        bpPerPx={view.bpPerPx}
        offsetPx={view.offsetPx}
      />
    )
  },
)

export default MultiLGVSyntenyDisplayComponent
