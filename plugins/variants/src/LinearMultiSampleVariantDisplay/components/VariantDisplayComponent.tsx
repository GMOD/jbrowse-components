import { useRef } from 'react'

import { useMouseState, useMouseTracking } from '@jbrowse/core/ui'
import { DisplayChrome } from '@jbrowse/plugin-linear-genome-view'
import { TreeSidebar } from '@jbrowse/tree-sidebar'
import { observer } from 'mobx-react'

import Crosshair from '../../shared/components/MultiSampleVariantCrosshairs.tsx'
import VariantOverlay from '../../shared/components/MultiSampleVariantOverlay.tsx'
import VariantBody from './VariantComponent.tsx'
import { VariantRenderer } from './VariantRenderer.ts'

import type { LinearMultiSampleVariantDisplayModel } from '../model.ts'
import type { MouseTracker } from '@jbrowse/core/ui'

// Its own component so that following the pointer re-renders the crosshair
// alone. Reading the position in `VariantDisplayComponent` instead would
// re-render `DisplayChrome` and every overlay on each mousemove — see
// `useMouseTracking`.
function CrosshairLayer({
  model,
  mouseTracker,
}: {
  model: LinearMultiSampleVariantDisplayModel
  mouseTracker: MouseTracker
}) {
  const mouseState = useMouseState(mouseTracker)
  return mouseState ? <Crosshair mouseState={mouseState} model={model} /> : null
}

const VariantDisplayComponent = observer(
  function VariantDisplayComponent(props: {
    model: LinearMultiSampleVariantDisplayModel
  }) {
    const { model } = props
    const ref = useRef<HTMLDivElement>(null)
    const { mouseTracker, handleMouseMove, handleMouseLeave } =
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
        {({ canvasRef, canvas }) => (
          <>
            <VariantBody model={model} canvasRef={canvasRef} canvas={canvas} />
            <VariantOverlay model={model} />
            <TreeSidebar model={model} />
            <CrosshairLayer model={model} mouseTracker={mouseTracker} />
          </>
        )}
      </DisplayChrome>
    )
  },
)

export default VariantDisplayComponent
