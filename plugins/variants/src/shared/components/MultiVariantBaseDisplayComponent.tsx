import { Suspense, useRef } from 'react'

import { observer } from 'mobx-react'

import Crosshair from './MultiVariantCrosshairs.tsx'
import LegendBar from './MultiVariantLegendBar.tsx'
import TreeSidebar from './TreeSidebar.tsx'
import { useMouseTracking } from '../hooks/useMouseTracking.ts'

import type { MultiVariantBaseModel } from '../MultiVariantBaseModel.ts'

type Model = MultiVariantBaseModel & {
  DisplayMessageComponent: React.ComponentType<any>
}

const MultiVariantBaseDisplayComponent = observer(
  function MultiVariantBaseDisplayComponent(props: { model: Model }) {
    const { model } = props
    const { DisplayMessageComponent } = model
    const ref = useRef<HTMLDivElement>(null)
    const { mouseState, handleMouseMove, handleMouseLeave } =
      useMouseTracking(ref)

    return (
      <div
        ref={ref}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <Suspense fallback={null}>
          <DisplayMessageComponent model={model} />
        </Suspense>
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
