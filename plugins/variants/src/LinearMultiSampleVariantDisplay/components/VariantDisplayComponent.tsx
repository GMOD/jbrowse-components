import { useRef } from 'react'

import { DisplayChrome } from '@jbrowse/plugin-linear-genome-view'
import { TreeSidebar } from '@jbrowse/tree-sidebar'
import { observer } from 'mobx-react'

import VariantBody from './VariantComponent.tsx'
import { VariantRenderer } from './VariantRenderer.ts'
import Crosshair from '../../shared/components/MultiSampleVariantCrosshairs.tsx'
import LegendOverlay from '../../shared/components/MultiSampleVariantLegendOverlay.tsx'
import { useMouseTracking } from '../../shared/hooks/useMouseTracking.ts'

import type { LinearMultiSampleVariantDisplayModel } from '../model.ts'

const VariantDisplayComponent = observer(
  function VariantDisplayComponent(props: {
    model: LinearMultiSampleVariantDisplayModel
  }) {
    const { model } = props
    const ref = useRef<HTMLDivElement>(null)
    const { mouseState, handleMouseMove, handleMouseLeave } =
      useMouseTracking(ref)

    return (
      <DisplayChrome
        model={model}
        factory={VariantRenderer}
        ref={ref}
        testid="variant-display"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {({ canvasRef, canvas }) => (
          <>
            <TreeSidebar model={model} />
            <LegendOverlay model={model} />
            <div style={{ position: 'absolute', left: 0 }}>
              <VariantBody
                model={model}
                canvasRef={canvasRef}
                canvas={canvas}
              />
            </div>
            {mouseState ? (
              <Crosshair mouseState={mouseState} model={model} />
            ) : null}
          </>
        )}
      </DisplayChrome>
    )
  },
)

export default VariantDisplayComponent
