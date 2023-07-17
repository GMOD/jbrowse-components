import React from 'react'
import { BaseLinearDisplayComponent } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

// locals
import { WiggleDisplayModel } from '../models/model'
import YScaleBars from './YScaleBars'

export default observer((props: { model: WiggleDisplayModel }) => {
  const { model } = props

  return (
    <div>
      <BaseLinearDisplayComponent {...props} />
      <YScaleBars model={model} />
    </div>
  )
})

export { default as YScaleBar } from '../../shared/YScaleBar'
