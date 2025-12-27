import { observer } from 'mobx-react'

import { BaseLinearDisplayComponent } from '../../BaseLinearDisplay'
import FloatingLabels from '../../BaseLinearDisplay/components/FloatingLabels'

import type { FeatureTrackModel } from '../model'

const LinearBasicDisplayComponent = observer(
  function LinearBasicDisplayComponent(props: { model: FeatureTrackModel }) {
    const { model } = props
    return (
      <BaseLinearDisplayComponent model={model}>
        <FloatingLabels model={model} />
      </BaseLinearDisplayComponent>
    )
  },
)

export default LinearBasicDisplayComponent
