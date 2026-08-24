import { useId } from 'react'

import { useMouseState } from '@jbrowse/core/ui'
import DisplayChrome from '@jbrowse/display-kit/DisplayChrome'
import { TreeSidebar } from '@jbrowse/tree-sidebar'
import { observer } from 'mobx-react'

import Crosshair from '../../shared/components/MultiSampleVariantCrosshairs.tsx'
import VariantOverlay from '../../shared/components/MultiSampleVariantOverlay.tsx'
import VariantScrollbar from '../../shared/components/VariantScrollbar.tsx'
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
// `rowsTopOffset` gates the CROSSHAIRS to the rows, the way the matrix gates
// its crosshair to the matrix rather than the connector zone: a crosshair drawn
// while the pointer is over the variant lane names a genotype row the pointer
// isn't on. The tooltip is not gated with them — the lane's marks are hoverable
// too, and what they report is the record itself. It arrives as a prop because
// this is a plain component and the observer below already tracks it.
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
  return mouseState ? (
    <Crosshair
      mouseState={mouseState}
      model={model}
      crosshairs={mouseState.y > rowsTopOffset}
    />
  ) : null
}

const VariantDisplayComponent = observer(
  function VariantDisplayComponent(props: {
    model: LinearMultiSampleVariantDisplayModel
  }) {
    const { model } = props
    const { rowsTopOffset } = model
    const canvasId = useId()
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
                canvasId={canvasId}
              />
            </div>
            {/* Outside that container, and it has to be: everything in there is
                absolutely positioned, so the container shrink-to-fits to 0x0 —
                fine for a child placed by `left`/`top`, fatal for one placed by
                `right`. The scrollbar's `right: 0` resolved against a zero-width
                box put the thumb 12px LEFT of the display (clipped away by
                `contain: strict`), and the edge fade's `left: 0; right: 0` made
                it zero-wide. Out here the box is the display's own, and
                `rowsTopOffset` is applied once rather than twice. */}
            <VariantScrollbar model={model} controlsId={canvasId} />
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
