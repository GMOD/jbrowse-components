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
        style={{ height: model.height }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {({ canvasRef }) => (
          <>
            <VariantBody model={model} canvasRef={canvasRef} />
            <LegendOverlay model={model} />
            <TreeSidebar model={model} />
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
