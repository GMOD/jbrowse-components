import { observer } from 'mobx-react'

import { BaseLinearDisplayComponent } from '../../BaseLinearDisplay'
import FloatingLabels from '../../BaseLinearDisplay/components/FloatingLabels'

import type { FeatureTrackModel } from '../model'

const LinearBasicDisplayComponent = observer(function (props: {
  model: FeatureTrackModel
}) {
  const { model } = props
  return (
    <div style={{ position: 'relative' }}>
      <BaseLinearDisplayComponent model={model} />
      <FloatingLabels model={model} />
    </div>
  )
})

export default LinearBasicDisplayComponent
