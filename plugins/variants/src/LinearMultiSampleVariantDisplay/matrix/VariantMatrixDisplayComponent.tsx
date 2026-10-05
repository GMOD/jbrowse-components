import BottomRightIndicators from '@jbrowse/display-kit/BottomRightIndicators'
import ConfigProblemsIndicator from '@jbrowse/display-kit/ConfigProblemsIndicator'
import DisplayChrome from '@jbrowse/display-kit/DisplayChrome'
import { DisplayContextMenu } from '@jbrowse/display-kit/DisplayContextMenu'
import { PointerLayer } from '@jbrowse/display-ui'
import { createMarkBackend } from '@jbrowse/render-core/marks/backend'
import { RowsPanel, treeSidebarRightEdge } from '@jbrowse/tree-sidebar'
import { observer } from 'mobx-react'

import Crosshair from '../../shared/components/MultiSampleVariantCrosshairs.tsx'
import VariantRowSeparators from '../../shared/components/VariantRowSeparators.tsx'
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

// The matrix's own box in the rows panel, clamped to the viewport's left edge.
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
  children,
}: {
  model: LinearMultiSampleVariantDisplayModel
  children: ReactNode
}) {
  return (
    <div style={{ position: 'absolute', left: model.columnGeometry.left }}>
      {children}
    </div>
  )
})

const VariantMatrixDisplayComponent = observer(
  function VariantMatrixDisplayComponent(props: {
    model: LinearMultiSampleVariantDisplayModel
  }) {
    const { model } = props
    const { rowsTopOffset } = model
    return (
      <DisplayChrome
        model={model}
        factory={createVariantMatrixBackend}
        testid="variant-matrix-display"
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
            <RowsPanel model={model} testIdPrefix="variant-matrix">
              <MatrixBodyOffset model={model}>
                <VariantMatrixBody model={model} canvasRef={canvasRef} />
              </MatrixBodyOffset>
              <VariantRowSeparators model={model} />
            </RowsPanel>
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
            <BottomRightIndicators scrollableHeight={model.scrollableHeight}>
              <ConfigProblemsIndicator notices={model.notices} />
            </BottomRightIndicators>
            <DisplayContextMenu model={model} />
          </>
        )}
      </DisplayChrome>
    )
  },
)

export default VariantMatrixDisplayComponent
