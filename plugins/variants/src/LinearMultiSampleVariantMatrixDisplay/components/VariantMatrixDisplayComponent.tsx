import { useRef } from 'react'

import { getContainingView } from '@jbrowse/core/util'
import { DisplayChrome } from '@jbrowse/plugin-linear-genome-view'
import { TreeSidebar } from '@jbrowse/tree-sidebar'
import { observer } from 'mobx-react'

import LinesConnectingMatrixToGenomicPosition from './LinesConnectingMatrixToGenomicPosition.tsx'
import VariantMatrixBody from './VariantMatrixComponent.tsx'
import { VariantMatrixRenderer } from './VariantMatrixRenderer.ts'
import Crosshair from '../../shared/components/MultiSampleVariantCrosshairs.tsx'
import LegendOverlay from '../../shared/components/MultiSampleVariantLegendOverlay.tsx'
import { useMouseTracking } from '../../shared/hooks/useMouseTracking.ts'

import type { LinearMultiSampleVariantMatrixDisplayModel } from '../model.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const VariantMatrixDisplayComponent = observer(
  function VariantMatrixDisplayComponent(props: {
    model: LinearMultiSampleVariantMatrixDisplayModel
  }) {
    const { model } = props
    const { lineZoneHeight, height } = model
    const view = getContainingView(model) as LinearGenomeViewModel
    const left = Math.max(0, -view.offsetPx)
    const ref = useRef<HTMLDivElement>(null)
    const { mouseState, handleMouseMove, handleMouseLeave } =
      useMouseTracking(ref)
    const inMatrix = mouseState && mouseState.y > lineZoneHeight

    return (
      <DisplayChrome
        model={model}
        factory={VariantMatrixRenderer}
        ref={ref}
        testid="variant-matrix-display"
        style={{ height }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {({ canvasRef, canvas }) => (
          <>
            <LinesConnectingMatrixToGenomicPosition
              model={model}
              crosshairX={inMatrix ? mouseState.x : undefined}
            />
            <div style={{ position: 'absolute', top: lineZoneHeight, left }}>
              <VariantMatrixBody
                model={model}
                canvasRef={canvasRef}
                canvas={canvas}
              />
            </div>
            <LegendOverlay model={model} top={lineZoneHeight} />
            <TreeSidebar model={model} />
            {inMatrix ? (
              <Crosshair mouseState={mouseState} model={model} />
            ) : null}
          </>
        )}
      </DisplayChrome>
    )
  },
)

export default VariantMatrixDisplayComponent
