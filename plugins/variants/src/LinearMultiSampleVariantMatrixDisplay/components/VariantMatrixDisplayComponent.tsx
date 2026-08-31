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
import LinesConnectingMatrixToGenomicPosition from './LinesConnectingMatrixToGenomicPosition.tsx'
import VariantMatrixBody, {
  variantMatrixSurface,
} from './VariantMatrixComponent.tsx'
import { VariantMatrixRenderer } from './VariantMatrixRenderer.ts'

import type { LinearMultiSampleVariantMatrixDisplayModel } from '../model.ts'
import type { ReactNode } from 'react'

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
  model: LinearMultiSampleVariantMatrixDisplayModel
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
    model: LinearMultiSampleVariantMatrixDisplayModel
  }) {
    const { model } = props
    const { rowsTopOffset, height } = model
    const canvasId = useId()
    return (
      <DisplayChrome
        model={model}
        factory={VariantMatrixRenderer}
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
        {({ canvasRef, canvas, mouseTracker }) => (
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
            <MatrixBodyOffset model={model} top={rowsTopOffset}>
              <VariantMatrixBody
                model={model}
                canvasRef={canvasRef}
                canvas={canvas}
                canvasId={canvasId}
              />
            </MatrixBodyOffset>
            {/* Outside `MatrixBodyOffset`, and it has to be: every child in
                there is absolutely positioned, so the box shrink-to-fits to 0x0
                — fine for a child placed by `left`/`top`, fatal for one placed
                by `right`. The scrollbar's `right: 0` resolved against a
                zero-width box put the thumb 12px LEFT of it (clipped away by
                `contain: strict`), and the edge fade's `left: 0; right: 0` made
                it zero-wide. It would also have panned horizontally with the
                matrix, which a scrollbar must not do. Out here the box is the
                display's own, and `rowsTopOffset` is applied once. */}
            <VariantScrollbar model={model} controlsId={canvasId} />
            <VariantOverlay model={model} top={rowsTopOffset} />
            <TreeSidebar model={model} />
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
