import { useRef, useState } from 'react'

import { BaseLinearDisplayComponent } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import Crosshair from './MultiVariantCrosshairs'
import LegendBar from './MultiVariantLegendBar'
import TreeSidebar from './TreeSidebar'

import type { MultiVariantBaseModel } from '../MultiVariantBaseModel'

const MultiVariantBaseDisplayComponent = observer(function (props: {
  model: MultiVariantBaseModel
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
      <TreeSidebar model={model} />
      <LegendBar model={model} />

      {mouseX && mouseY ? (
        <Crosshair mouseX={mouseX} mouseY={mouseY} model={model} />
      ) : null}
    </div>
  )
})

export default MultiVariantBaseDisplayComponent
