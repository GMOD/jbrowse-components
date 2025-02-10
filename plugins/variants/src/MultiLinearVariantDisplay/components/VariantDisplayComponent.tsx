import { useRef, useState } from 'react'

import { BaseLinearDisplayComponent } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import Crosshair from './Crosshair'
import LegendBar from '../../shared/components/LegendBar'

import type { MultiLinearVariantDisplayModel } from '../model'

const MultiLinearVariantDisplayComponent = observer(function (props: {
  model: MultiLinearVariantDisplayModel
}) {
  const { model } = props
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
      <BaseLinearDisplayComponent {...props} />
      <LegendBar model={model} />

      {mouseX && mouseY ? (
        <Crosshair mouseX={mouseX} mouseY={mouseY} model={model} />
      ) : null}
    </div>
  )
})

export default MultiLinearVariantDisplayComponent
