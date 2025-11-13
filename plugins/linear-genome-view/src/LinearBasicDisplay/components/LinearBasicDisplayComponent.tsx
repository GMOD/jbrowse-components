import { observer } from 'mobx-react'

import { BaseLinearDisplayComponent } from '../../BaseLinearDisplay'
import FloatingLabels from '../../BaseLinearDisplay/components/FloatingLabels'

import type { BaseLinearDisplayModel } from '../../BaseLinearDisplay'

const LinearBasicDisplayComponent = observer(function (props: {
  model: BaseLinearDisplayModel
}) {
  const { model } = props
  return (
    <>
      <BaseLinearDisplayComponent model={model} />
      <FloatingLabels model={model} />
    </>
  )
})

export default LinearBasicDisplayComponent
