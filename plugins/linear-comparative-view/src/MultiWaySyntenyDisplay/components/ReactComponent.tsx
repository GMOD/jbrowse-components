import { DisplayStatusChrome } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import MultiWayRows from './MultiWayRows.tsx'

import type { MultiWaySyntenyDisplayModel } from '../model.ts'

const MultiWaySyntenyReactComponent = observer(
  function MultiWaySyntenyReactComponent({
    model,
    exportSVG,
  }: {
    model: MultiWaySyntenyDisplayModel
    exportSVG?: boolean
  }) {
    return (
      <DisplayStatusChrome
        model={model}
        phase={model.displayPhase}
        drawn={model.painted}
        testid="multiway-synteny-display"
      >
        <MultiWayRows model={model} exportSVG={exportSVG} />
      </DisplayStatusChrome>
    )
  },
)

export default MultiWaySyntenyReactComponent
