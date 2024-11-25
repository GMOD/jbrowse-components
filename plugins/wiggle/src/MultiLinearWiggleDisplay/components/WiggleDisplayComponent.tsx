import React from 'react'
import { BaseLinearDisplayComponent } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

// locals
import YScaleBars from './YScaleBars'
import type { WiggleDisplayModel } from '../model'

const MultiLinearWiggleDisplayComponent = observer(function (props: {
  model: WiggleDisplayModel
}) {
  const { model } = props

  return (
    <div>
      <BaseLinearDisplayComponent {...props} />
      <YScaleBars model={model} />
    </div>
  )
})

export default MultiLinearWiggleDisplayComponent
