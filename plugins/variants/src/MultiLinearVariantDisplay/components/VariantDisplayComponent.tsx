import React from 'react'

import { BaseLinearDisplayComponent } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

// locals
import YScaleBars from './YScaleBars'

import type { VariantDisplayModel } from '../model'

const MultiLinearVariantDisplayComponent = observer(function (props: {
  model: VariantDisplayModel
}) {
  const { model } = props

  return (
    <div>
      <BaseLinearDisplayComponent {...props} />
      <YScaleBars model={model} />
    </div>
  )
})

export default MultiLinearVariantDisplayComponent
