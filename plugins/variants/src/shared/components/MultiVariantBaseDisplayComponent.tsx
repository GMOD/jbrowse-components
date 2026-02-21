import { Suspense, useRef } from 'react'

import { FloatingLegend } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import Crosshair from './MultiVariantCrosshairs.tsx'
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
        style={{ position: 'relative' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <TreeSidebar model={model} />
        <FloatingLegend items={model.legendItems()} />
        <Suspense fallback={null}>
          <DisplayMessageComponent model={model} />
        </Suspense>

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
