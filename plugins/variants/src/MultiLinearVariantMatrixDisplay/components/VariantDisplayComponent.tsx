import { useRef, useState } from 'react'

import { BaseLinearDisplayComponent } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import LinesConnectingMatrixToGenomicPosition from './LinesConnectingMatrixToGenomicPosition'
import Crosshair from '../../shared/components/MultiVariantCrosshairs'
import LegendBar from '../../shared/components/MultiVariantLegendBar'

import type { MultiLinearVariantMatrixDisplayModel } from '../model'

const MultiLinearVariantMatrixDisplayComponent = observer(function (props: {
  model: MultiLinearVariantMatrixDisplayModel
}) {
  const { model } = props
  const { lineZoneHeight } = model
  const ref = useRef<HTMLDivElement>(null)
  const [mouseY, setMouseY] = useState<number>()
  const [mouseX, setMouseX] = useState<number>()

  return (
    <div
      ref={ref}
      onMouseMove={event => {
        const rect = ref.current?.getBoundingClientRect()
        const top = rect?.top || 0
        const left = rect?.left || 0
        setMouseY(event.clientY - top)
        setMouseX(event.clientX - left)
      }}
      onMouseLeave={() => {
        setMouseY(undefined)
        setMouseX(undefined)
      }}
    >
      <div style={{ position: 'relative' }}>
        <LinesConnectingMatrixToGenomicPosition model={model} />
        <div style={{ position: 'absolute', top: lineZoneHeight }}>
          <LegendBar model={model} />
          <BaseLinearDisplayComponent {...props} />
        </div>
      </div>

      {mouseX && mouseY && mouseY > lineZoneHeight ? (
        <Crosshair mouseX={mouseX} mouseY={mouseY} model={model} />
      ) : null}
    </div>
  )
})
export default MultiLinearVariantMatrixDisplayComponent
