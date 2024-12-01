import React from 'react'

import { BaseLinearDisplayComponent } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

// locals
import YScaleBars from '../../shared/YScaleBars'

import type { LinearVariantMatrixDisplayModel } from '../model'

const MultiLinearVariantMatrixDisplayComponent = observer(function (props: {
  model: LinearVariantMatrixDisplayModel
}) {
  const { model } = props

  return (
    <div>
      <BaseLinearDisplayComponent {...props} />
      <YScaleBars model={model} />
    </div>
  )
})

export default MultiLinearVariantMatrixDisplayComponent
