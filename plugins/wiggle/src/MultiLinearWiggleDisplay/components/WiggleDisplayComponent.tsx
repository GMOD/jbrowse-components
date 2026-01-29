import { BaseLinearDisplayComponent } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import TreeSidebar from './TreeSidebar.tsx'
import YScaleBars from './YScaleBars.tsx'

import type { WiggleDisplayModel } from '../model.ts'

const MultiLinearWiggleDisplayComponent = observer(
  function MultiLinearWiggleDisplayComponent(props: {
    model: WiggleDisplayModel
  }) {
    const { model } = props
    const { isMultiRow } = model

    return (
      <div>
        {isMultiRow ? <TreeSidebar model={model} /> : null}
        <BaseLinearDisplayComponent {...props} />
        <YScaleBars model={model} />
      </div>
    )
  },
)

export default MultiLinearWiggleDisplayComponent
