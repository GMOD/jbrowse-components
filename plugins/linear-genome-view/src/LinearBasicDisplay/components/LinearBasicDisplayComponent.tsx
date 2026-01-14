import { observer } from 'mobx-react'

import FloatingLabels from '../../BaseLinearDisplay/components/FloatingLabels.tsx'
import { BaseLinearDisplayComponent } from '../../BaseLinearDisplay/index.ts'

import type { FeatureTrackModel } from '../model.ts'

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
