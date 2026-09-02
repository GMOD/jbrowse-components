import { useId, useState } from 'react'

import DisplayChrome from '@jbrowse/display-kit/DisplayChrome'
import { DisplayContextMenu } from '@jbrowse/display-kit/DisplayContextMenu'
import { PointerLayer } from '@jbrowse/display-ui'
import { TreeSidebar, treeSidebarRightEdge } from '@jbrowse/tree-sidebar'
import { observer } from 'mobx-react'

import Crosshair from '../../shared/components/MultiSampleVariantCrosshairs.tsx'
import VariantOverlay from '../../shared/components/MultiSampleVariantOverlay.tsx'
import VariantScrollbar from '../../shared/components/VariantScrollbar.tsx'
import { useVariantVirtualScroll } from '../../shared/useVariantVirtualScroll.ts'
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
    // The rows panel, not the canvas: a canvas holds no DOM children, so the
    // dendrogram and the row labels beside it are siblings, and a wheel over
    // them never reached a canvas-bound listener — it fell through and panned
    // the view instead of scrolling the rows it was over. Same shape MAF uses.
    const [rowsEl, setRowsEl] = useState<HTMLDivElement | null>(null)
    useVariantVirtualScroll(rowsEl, model)
    return (
      <DisplayChrome
        model={model}
        factory={VariantRenderer}
        testid="variant-display"
        style={{ height: model.height }}
        // One pointer source for the whole display: the hover, the tooltip and
        // the crosshairs come off the chrome's single measurement, in one
        // frame. Which surface the pointer is over is the same y test
        // `PointerLayer`'s `inRows` makes. The sidebar overlays only the ROWS
        // and owns its own hover there, so its x-gate applies to the rows
        // branch alone — the lane band spans the full width above it, and its
        // click handlers take no x-gate either.
        onPointerPosition={state => {
          if (!state) {
            model.clearHoveredFeature()
          } else if (state.y >= rowsTopOffset) {
            if (state.x < treeSidebarRightEdge(model)) {
              model.clearHoveredFeature()
            } else {
              hoverVariantSurface(
                model,
                variantRowsSurface(model),
                state.x,
                state.y - rowsTopOffset,
              )
            }
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
        {({ canvasRef, mouseTracker }) => (
          <>
            <VariantLaneOverlay model={model} />
            {/* The rows and everything positioned against them sit below the
                bands `topBands` reserved. Same container offset the matrix
                display takes for its connector zone, and the same one
                `SvgVariantOverlay` translates the export by — `TreeSidebar`
                takes it off the model as `rowsTopOffset`. */}
            <div
              ref={setRowsEl}
              data-testid="variant-rows-panel"
              style={{
                position: 'absolute',
                top: rowsTopOffset,
                left: 0,
                width: model.canvasWidthPx,
                height: model.availableHeight,
              }}
            >
              <VariantBody
                model={model}
                canvasRef={canvasRef}
                canvasId={canvasId}
              />
              {/* Inside the panel so a wheel over the dendrogram scrolls the
                  rows it labels, which means the offset is on the container and
                  the portaled half takes it explicitly (`top`). */}
              <TreeSidebar model={model} top={rowsTopOffset} />
            </div>
            {/* Outside that container, and it has to be: the panel is sized to
                the rows, so a child placed by `right` would anchor to the
                canvas width rather than to the display. It used to shrink to
                0x0, where the scrollbar's `right: 0` put the thumb 12px LEFT of
                the display (clipped away by `contain: strict`) and the edge
                fade's `left: 0; right: 0` made it zero-wide. Out here the box
                is the display's own, and `rowsTopOffset` is applied once rather
                than twice. */}
            <VariantScrollbar model={model} controlsId={canvasId} />
            <VariantOverlay model={model} top={rowsTopOffset} />
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
