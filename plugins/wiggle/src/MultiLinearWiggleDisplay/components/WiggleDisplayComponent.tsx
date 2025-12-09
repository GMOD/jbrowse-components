import { useRef } from 'react'

import { BaseLinearDisplayComponent } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import Crosshairs from './Crosshairs'
import YScaleBars from './YScaleBars'
import { useMouseTracking } from './useMouseTracking'

import type { WiggleDisplayModel } from '../model'

const MultiLinearWiggleDisplayComponent = observer(function (props: {
  model: WiggleDisplayModel
}) {
  const { model } = props
  const ref = useRef<HTMLDivElement>(null)
  const { mouseState, handleMouseMove, handleMouseLeave } = useMouseTracking(ref)

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <BaseLinearDisplayComponent {...props} />
      <YScaleBars model={model} />
      {mouseState ? <Crosshairs mouseY={mouseState.y} model={model} /> : null}
    </div>
  )
})

export default MultiLinearWiggleDisplayComponent
