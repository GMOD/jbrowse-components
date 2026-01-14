import { useRef } from 'react'

import { BaseLinearDisplayComponent } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import Crosshair from './MultiVariantCrosshairs.tsx'
import LegendBar from './MultiVariantLegendBar.tsx'
import TreeSidebar from './TreeSidebar.tsx'
import { useMouseTracking } from '../hooks/useMouseTracking.ts'

import type { MultiVariantBaseModel } from '../MultiVariantBaseModel.ts'

const MultiVariantBaseDisplayComponent = observer(
  function MultiVariantBaseDisplayComponent(props: {
    model: MultiVariantBaseModel
  }) {
    const { model } = props
    const ref = useRef<HTMLDivElement>(null)
    const { mouseState, handleMouseMove, handleMouseLeave } =
      useMouseTracking(ref)

    return (
      <div
        ref={ref}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <BaseLinearDisplayComponent {...props} />
        <TreeSidebar model={model} />
        <LegendBar model={model} />

        {mouseState ? (
          <Crosshair
            mouseX={mouseState.x}
            mouseY={mouseState.y}
            offsetX={mouseState.offsetX}
            offsetY={mouseState.offsetY}
            model={model}
          />
        ) : null}
      </div>
    )
  },
)

export default MultiVariantBaseDisplayComponent
