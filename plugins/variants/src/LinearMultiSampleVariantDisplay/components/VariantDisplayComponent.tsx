import { useMouseState } from '@jbrowse/core/ui'
import { DisplayChrome } from '@jbrowse/plugin-linear-genome-view'
import { TreeSidebar } from '@jbrowse/tree-sidebar'
import { observer } from 'mobx-react'

import Crosshair from '../../shared/components/MultiSampleVariantCrosshairs.tsx'
import VariantOverlay from '../../shared/components/MultiSampleVariantOverlay.tsx'
import VariantBody from './VariantComponent.tsx'
import VariantLaneOverlay from './VariantLaneOverlay.tsx'
import { VariantRenderer } from './VariantRenderer.ts'

import type { LinearMultiSampleVariantDisplayModel } from '../model.ts'
import type { MouseTracker } from '@jbrowse/core/ui'

// Its own component so that following the pointer re-renders the crosshair
// alone. Reading the position in `VariantDisplayComponent` instead would
// re-render `DisplayChrome` and every overlay on each mousemove — see
// `useMouseTracking`.
//
// `rowsTopOffset` gates it to the rows, the way the matrix gates its crosshair
// to the matrix rather than the connector zone: a crosshair drawn while the
// pointer is over the variant lane names a genotype row the pointer isn't on.
// It arrives as a prop because this is a plain component and the observer below
// already tracks it.
function CrosshairLayer({
  model,
  mouseTracker,
  rowsTopOffset,
}: {
  model: LinearMultiSampleVariantDisplayModel
  mouseTracker: MouseTracker
  rowsTopOffset: number
}) {
  const mouseState = useMouseState(mouseTracker)
  return mouseState && mouseState.y > rowsTopOffset ? (
    <Crosshair mouseState={mouseState} model={model} />
  ) : null
}

const VariantDisplayComponent = observer(
  function VariantDisplayComponent(props: {
    model: LinearMultiSampleVariantDisplayModel
  }) {
    const { model } = props
    const { rowsTopOffset } = model
    return (
      <DisplayChrome
        model={model}
        factory={VariantRenderer}
        testid="variant-display"
        style={{ height: model.height }}
      >
        {({ canvasRef, canvas, mouseTracker }) => (
          <>
            <VariantLaneOverlay model={model} />
            {/* The rows and everything positioned against them sit below the
                bands `topBands` reserved. Same container offset the matrix
                display takes for its connector zone, and the same one
                `SvgVariantOverlay` translates the export by — `TreeSidebar`
                takes it off the model as `rowsTopOffset`. */}
            <div style={{ position: 'absolute', top: rowsTopOffset, left: 0 }}>
              <VariantBody
                model={model}
                canvasRef={canvasRef}
                canvas={canvas}
              />
            </div>
            <VariantOverlay model={model} top={rowsTopOffset} />
            <TreeSidebar model={model} />
            <CrosshairLayer
              model={model}
              mouseTracker={mouseTracker}
              rowsTopOffset={rowsTopOffset}
            />
          </>
        )}
      </DisplayChrome>
    )
  },
)

export default VariantDisplayComponent
