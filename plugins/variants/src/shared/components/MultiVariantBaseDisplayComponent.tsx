import { useRef } from 'react'

import { BaseLinearDisplayComponent } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import Crosshair from './MultiVariantCrosshairs'
import LegendBar from './MultiVariantLegendBar'
import TreeSidebar from './TreeSidebar'
import { useMouseTracking } from '../hooks/useMouseTracking'

import type { MultiVariantBaseModel } from '../MultiVariantBaseModel'

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
