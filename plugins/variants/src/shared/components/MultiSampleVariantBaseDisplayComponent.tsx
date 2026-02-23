import { Suspense, useRef } from 'react'

import { FloatingLegend } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import Crosshair from './MultiSampleVariantCrosshairs.tsx'
import LegendBar from './MultiSampleVariantLegendBar.tsx'
import TreeSidebar from './TreeSidebar.tsx'
import { useMouseTracking } from '../hooks/useMouseTracking.ts'

import type { MultiSampleVariantBaseModel } from '../MultiSampleVariantBaseModel.ts'

type Model = MultiSampleVariantBaseModel & {
  DisplayMessageComponent: React.ComponentType<any>
}

const MultiSampleVariantBaseDisplayComponent = observer(
  function MultiSampleVariantBaseDisplayComponent(props: { model: Model }) {
    const { model } = props
    const {
      DisplayMessageComponent,
      availableHeight,
      showTree,
      hierarchy,
      treeAreaWidth,
    } = model
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
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            height: availableHeight,
            zIndex: 100,
            pointerEvents: 'none',
            overflow: 'hidden',
          }}
        >
          <g
            transform={`translate(${showTree && hierarchy ? treeAreaWidth : 0})`}
          >
            <LegendBar model={model} />
          </g>
        </svg>
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

export default MultiSampleVariantBaseDisplayComponent
