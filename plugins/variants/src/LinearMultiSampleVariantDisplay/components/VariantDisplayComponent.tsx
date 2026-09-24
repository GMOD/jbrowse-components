import { useId, useState } from 'react'

import { ScrollChrome } from '@jbrowse/core/ui'
import { useRowVirtualScroll } from '@jbrowse/core/util/useRowVirtualScroll'
import DisplayChrome from '@jbrowse/display-kit/DisplayChrome'
import { DisplayContextMenu } from '@jbrowse/display-kit/DisplayContextMenu'
import { PointerLayer } from '@jbrowse/display-ui'
import { createMarkBackend } from '@jbrowse/render-core/marks/backend'
import { TreeSidebar, treeSidebarRightEdge } from '@jbrowse/tree-sidebar'
import { observer } from 'mobx-react'

import Crosshair from '../../shared/components/MultiSampleVariantCrosshairs.tsx'
import VariantOverlay from '../../shared/components/MultiSampleVariantOverlay.tsx'
import { hoverVariantSurface } from '../../shared/variantSurface.ts'
import VariantMatrixDisplayComponent from '../matrix/VariantMatrixDisplayComponent.tsx'
import VariantBody, { variantRowsSurface } from './VariantComponent.tsx'
import VariantLaneOverlay, {
  variantLaneSurface,
} from './VariantLaneOverlay.tsx'
import { VARIANT_MARKS } from './variantMarks.ts'

import type { LinearMultiSampleVariantDisplayModel } from '../model.ts'

async function createVariantBackend(canvas: HTMLCanvasElement) {
  return Object.assign(await createMarkBackend(canvas, VARIANT_MARKS), {
    columns: false as const,
  })
}

const GenomicPositionsDisplay = observer(
  function GenomicPositionsDisplay(props: {
    model: LinearMultiSampleVariantDisplayModel
  }) {
    const { model } = props
    const { rowsTopOffset } = model
    const canvasId = useId()
    // the rows panel, so a wheel over the dendrogram beside the canvas is theirs
    const [rowsEl, setRowsEl] = useState<HTMLDivElement | null>(null)
    useRowVirtualScroll(rowsEl, model, model.view.scrollZoom)
    return (
      <DisplayChrome
        model={model}
        factory={createVariantBackend}
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
            {/* On the display's own box: the rows panel is canvas-wide, and
                anything placed by `right` belongs to the display (CLAUDE.md). */}
            <ScrollChrome
              model={model}
              controlsId={canvasId}
              top={rowsTopOffset}
            />
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

// Each layout mounts its own chrome, so a switch swaps the GPU program too.
const VariantDisplayComponent = observer(function VariantDisplayComponent({
  model,
}: {
  model: LinearMultiSampleVariantDisplayModel
}) {
  return model.atGenomicPositions ? (
    <GenomicPositionsDisplay model={model} />
  ) : (
    <VariantMatrixDisplayComponent model={model} />
  )
})

export default VariantDisplayComponent
