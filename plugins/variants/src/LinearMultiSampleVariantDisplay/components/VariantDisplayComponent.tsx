import { useId } from 'react'

import DisplayChrome from '@jbrowse/display-kit/DisplayChrome'
import { DisplayContextMenu } from '@jbrowse/display-kit/DisplayContextMenu'
import { PointerLayer } from '@jbrowse/display-ui'
import { TreeSidebar, treeSidebarRightEdge } from '@jbrowse/tree-sidebar'
import { observer } from 'mobx-react'

import Crosshair from '../../shared/components/MultiSampleVariantCrosshairs.tsx'
import VariantOverlay from '../../shared/components/MultiSampleVariantOverlay.tsx'
import VariantScrollbar from '../../shared/components/VariantScrollbar.tsx'
import { hoverVariantSurface } from '../../shared/variantSurface.ts'
import VariantBody, { variantRowsSurface } from './VariantComponent.tsx'
import VariantLaneOverlay, {
  variantLaneSurface,
} from './VariantLaneOverlay.tsx'
import { VariantRenderer } from './VariantRenderer.ts'

import type { LinearMultiSampleVariantDisplayModel } from '../model.ts'

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
        // One pointer source for the whole display: the hover, the tooltip and
        // the crosshairs come off the chrome's single measurement, in one
        // frame. Which surface the pointer is over is the same y test
        // `PointerLayer`'s `inRows` makes; the sidebar overlays the rows and
        // owns its own hover, so a pointer over it hovers nothing here.
        onPointerPosition={state => {
          if (!state || state.x < treeSidebarRightEdge(model)) {
            model.clearHoveredFeature()
          } else if (state.y > rowsTopOffset) {
            hoverVariantSurface(
              model,
              variantRowsSurface(model),
              state.x,
              state.y - rowsTopOffset,
            )
          } else {
            hoverVariantSurface(
              model,
              variantLaneSurface(model),
              state.x,
              state.y,
            )
          }
        }}
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
            {/* The crosshairs are gated to the rows: drawn over the variant
                lane they would name a genotype row the pointer is not on. The
                tooltip is not — the lane's marks are hoverable too, and what
                they report is the record itself. */}
            <PointerLayer
              mouseTracker={mouseTracker}
              rowsTopOffset={rowsTopOffset}
            >
              {(mouseState, inRows) =>
                mouseState ? (
                  <Crosshair
                    mouseState={mouseState}
                    model={model}
                    crosshairs={inRows}
                  />
                ) : null
              }
            </PointerLayer>
            <DisplayContextMenu model={model} />
          </>
        )}
      </DisplayChrome>
    )
  },
)

export default VariantDisplayComponent
