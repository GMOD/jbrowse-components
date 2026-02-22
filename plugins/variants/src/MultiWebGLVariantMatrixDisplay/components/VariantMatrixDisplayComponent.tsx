import { Suspense, useRef } from 'react'

import { FloatingLegend } from '@jbrowse/plugin-linear-genome-view'
import { getContainingView } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import LinesConnectingMatrixToGenomicPosition from './LinesConnectingMatrixToGenomicPosition.tsx'
import Crosshair from '../../shared/components/MultiSampleVariantCrosshairs.tsx'
import TreeSidebar from '../../shared/components/TreeSidebar.tsx'
import { useMouseTracking } from '../../shared/hooks/useMouseTracking.ts'

import type { LinearVariantMatrixDisplayModel } from '../model.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const VariantMatrixDisplayComponent = observer(
  function VariantMatrixDisplayComponent(props: {
    model: LinearVariantMatrixDisplayModel
  }) {
    const { model } = props
    const { DisplayMessageComponent, lineZoneHeight, height } = model
    const view = getContainingView(model) as LinearGenomeViewModel
    const left = Math.max(0, -view.offsetPx)
    const ref = useRef<HTMLDivElement>(null)
    const { mouseState, handleMouseMove, handleMouseLeave } =
      useMouseTracking(ref)

    return (
      <div
        ref={ref}
        style={{ position: 'relative', height }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <LinesConnectingMatrixToGenomicPosition model={model} />
        <div style={{ position: 'absolute', top: lineZoneHeight, left }}>
          <Suspense fallback={null}>
            <DisplayMessageComponent model={model} />
          </Suspense>
        </div>
        <TreeSidebar model={model} />
        <FloatingLegend items={model.legendItems()} />
        {mouseState && mouseState.y > lineZoneHeight ? (
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

export default VariantMatrixDisplayComponent
