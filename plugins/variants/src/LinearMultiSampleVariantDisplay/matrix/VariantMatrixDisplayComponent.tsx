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
import LinesConnectingMatrixToGenomicPosition from './LinesConnectingMatrixToGenomicPosition.tsx'
import VariantMatrixBody, {
  variantMatrixSurface,
} from './VariantMatrixComponent.tsx'
import { VARIANT_MATRIX_MARKS } from './variantMatrixMarks.ts'

import type { LinearMultiSampleVariantDisplayModel } from '../model.ts'
import type { ReactNode } from 'react'

async function createVariantMatrixBackend(canvas: HTMLCanvasElement) {
  return Object.assign(await createMarkBackend(canvas, VARIANT_MATRIX_MARKS), {
    columns: true as const,
  })
}

// The matrix's own box, offset past the bands above the rows and clamped to the
// viewport's left edge.
//
// Its own observer purely so the column origin is read HERE. It moves every
// frame of a pan, and read in the component that mounts `DisplayChrome` it
// re-rendered the chrome for the whole of every drag — `useRenderingBackend`
// re-run, the status container rebuilt with a fresh inline `style`, the overlay
// portal re-created — to move one div. The body inside is passed as `children`,
// so it is an element built by the caller and re-renders on its own terms.
//
// `columnGeometry.left`, not a second `Math.max(0, -view.offsetPx)`: that is the
// origin the columns, the connector lines and the hit test are all laid out
// from, so the box holding them has to be the same number rather than a
// same-looking expression beside it.
const MatrixBodyOffset = observer(function MatrixBodyOffset({
  model,
  top,
  children,
}: {
  model: LinearMultiSampleVariantDisplayModel
  top: number
  children: ReactNode
}) {
  return (
    <div
      style={{
        position: 'absolute',
        top,
        left: model.columnGeometry.left,
      }}
    >
      {children}
    </div>
  )
})

const VariantMatrixDisplayComponent = observer(
  function VariantMatrixDisplayComponent(props: {
    model: LinearMultiSampleVariantDisplayModel
  }) {
    const { model } = props
    const { rowsTopOffset, height } = model
    const canvasId = useId()
    // the rows panel, so a wheel over the dendrogram beside the matrix is theirs
    const [rowsEl, setRowsEl] = useState<HTMLDivElement | null>(null)
    useRowVirtualScroll(rowsEl, model, model.view.scrollZoom)
    return (
      <DisplayChrome
        model={model}
        factory={createVariantMatrixBackend}
        testid="variant-matrix-display"
        style={{ height }}
        // One pointer source for the whole display: the hover, the tooltip,
        // the crosshairs and the highlighted connector all come off the
        // chrome's single measurement, in one frame. `columnGeometry.left` is
        // read inside the handler rather than during render, so a pan moves the
        // column origin without re-rendering the chrome.
        onPointerPosition={state => {
          if (
            state &&
            state.y >= rowsTopOffset &&
            state.x >= treeSidebarRightEdge(model)
          ) {
            hoverVariantSurface(
              model,
              variantMatrixSurface(model),
              state.x - model.columnGeometry.left,
              state.y - rowsTopOffset,
            )
          } else {
            model.clearHoveredFeature()
          }
        }}
      >
        {({ canvasRef, mouseTracker }) => (
          <>
            {/* Both pointer-driven pieces share one definition of "the cursor
                is in the matrix rather than in the bands above it".
                `rowsTopOffset` and not `lineZoneHeight`: the connector zone is
                the only band this display currently stacks, so the two are
                equal here — but the offset the rows actually begin at is the
                total, and reaching for one band's height as if it were that
                total is what `shared/variantTopBands.ts` exists to stop. */}
            <PointerLayer
              mouseTracker={mouseTracker}
              rowsTopOffset={rowsTopOffset}
            >
              {(mouseState, inMatrix) => (
                <LinesConnectingMatrixToGenomicPosition
                  model={model}
                  crosshairX={inMatrix ? mouseState?.x : undefined}
                />
              )}
            </PointerLayer>
            {/* The rows panel the wheel is bound to. It carries the band
                offset so `applyRowResizeWheel` measures against the rows' own
                top, which leaves `MatrixBodyOffset` with the horizontal column
                origin alone — the number that moves every frame of a pan, and
                the reason it is read in a child observer. */}
            <div
              ref={setRowsEl}
              data-testid="variant-matrix-rows-panel"
              style={{
                position: 'absolute',
                top: rowsTopOffset,
                left: 0,
                width: model.canvasWidthPx,
                height: model.availableHeight,
              }}
            >
              <MatrixBodyOffset model={model} top={0}>
                <VariantMatrixBody
                  model={model}
                  canvasRef={canvasRef}
                  canvasId={canvasId}
                />
              </MatrixBodyOffset>
              {/* Inside the panel so a wheel over the dendrogram scrolls the
                  rows it labels; the portaled half takes the offset the
                  container already carries. */}
              <TreeSidebar model={model} top={rowsTopOffset} />
            </div>
            {/* Outside `MatrixBodyOffset`, a 0x0 box that pans with the matrix:
                anything placed by `right` belongs to the display (CLAUDE.md). */}
            <ScrollChrome
              model={model}
              controlsId={canvasId}
              top={rowsTopOffset}
            />
            <VariantOverlay model={model} top={rowsTopOffset} />
            <PointerLayer
              mouseTracker={mouseTracker}
              rowsTopOffset={rowsTopOffset}
            >
              {(mouseState, inMatrix) =>
                mouseState && inMatrix ? (
                  <Crosshair mouseState={mouseState} model={model} />
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

export default VariantMatrixDisplayComponent
