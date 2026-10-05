import { ConfigProblemsCorner } from '@jbrowse/display-kit/ConfigProblemsIndicator'
import DisplayChrome from '@jbrowse/display-kit/DisplayChrome'
import { DisplayContextMenu } from '@jbrowse/display-kit/DisplayContextMenu'
import { PointerLayer } from '@jbrowse/display-ui'
import { createMarkBackend } from '@jbrowse/render-core/marks/backend'
import { RowsPanel, treeSidebarRightEdge } from '@jbrowse/tree-sidebar'
import { observer } from 'mobx-react'

import LinesConnectingMatrixToGenomicPosition from '../matrix/LinesConnectingMatrixToGenomicPosition.tsx'
import VariantMatrixBody, {
  variantMatrixSurface,
} from '../matrix/VariantMatrixComponent.tsx'
import { VARIANT_MATRIX_MARKS } from '../matrix/variantMatrixMarks.ts'
import Crosshair from './MultiSampleVariantCrosshairs.tsx'
import VariantBody, { variantRowsSurface } from './VariantComponent.tsx'
import VariantLaneOverlay, {
  variantLaneSurface,
} from './VariantLaneOverlay.tsx'
import VariantRowSeparators from './VariantRowSeparators.tsx'
import { VARIANT_MARKS } from './variantMarks.ts'
import { hoverVariantSurface } from './variantSurface.ts'

import type {
  LinearMultiSampleVariantDisplayModel,
  VariantLayoutBackend,
} from '../model.ts'
import type { MouseState } from '@jbrowse/core/ui'
import type { ReactNode } from 'react'

type Model = LinearMultiSampleVariantDisplayModel

const layoutBackends: Record<
  Model['variantLayout'],
  (canvas: HTMLCanvasElement) => Promise<VariantLayoutBackend>
> = {
  genomic: async canvas =>
    Object.assign(await createMarkBackend(canvas, VARIANT_MARKS), {
      columns: false as const,
    }),
  columns: async canvas =>
    Object.assign(await createMarkBackend(canvas, VARIANT_MATRIX_MARKS), {
      columns: true as const,
    }),
}

// The sidebar overlays only the rows, so its x-gate applies there alone; the
// lane band spans the full width above.
function hoverGenomic(model: Model, state: MouseState) {
  const { rowsTopOffset } = model
  if (state.y < rowsTopOffset) {
    hoverVariantSurface(model, variantLaneSurface(model), state.x, state.y)
  } else if (state.x < treeSidebarRightEdge(model)) {
    model.clearHoveredFeature()
  } else {
    hoverVariantSurface(
      model,
      variantRowsSurface(model),
      state.x,
      state.y - rowsTopOffset,
    )
  }
}

// `columnGeometry.left` is read here rather than during render, so a pan moves
// the column origin without re-rendering the chrome.
function hoverColumns(model: Model, state: MouseState) {
  const { rowsTopOffset } = model
  if (state.y >= rowsTopOffset && state.x >= treeSidebarRightEdge(model)) {
    hoverVariantSurface(
      model,
      variantMatrixSurface(model),
      state.x - model.columnGeometry.left,
      state.y - rowsTopOffset,
    )
  } else {
    model.clearHoveredFeature()
  }
}

// Its own observer so the per-frame column origin re-renders one div, not the
// chrome. `columnGeometry.left` is the origin the columns, connectors and hit
// test are laid out from.
const MatrixBodyOffset = observer(function MatrixBodyOffset({
  model,
  children,
}: {
  model: Model
  children: ReactNode
}) {
  return (
    <div style={{ position: 'absolute', left: model.columnGeometry.left }}>
      {children}
    </div>
  )
})

// Keyed by layout so a switch remounts the chrome and its GPU program.
const VariantDisplayComponent = observer(function VariantDisplayComponent({
  model,
}: {
  model: Model
}) {
  const { rowsTopOffset, variantLayout, atGenomicPositions: genomic } = model
  return (
    <DisplayChrome
      key={variantLayout}
      model={model}
      factory={layoutBackends[variantLayout]}
      testid={genomic ? 'variant-display' : 'variant-matrix-display'}
      onPointerPosition={state => {
        if (!state) {
          model.clearHoveredFeature()
        } else if (genomic) {
          hoverGenomic(model, state)
        } else {
          hoverColumns(model, state)
        }
      }}
    >
      {({ canvasRef, mouseTracker }) => (
        <>
          {genomic ? (
            <VariantLaneOverlay model={model} />
          ) : (
            <PointerLayer
              mouseTracker={mouseTracker}
              rowsTopOffset={rowsTopOffset}
            >
              {(mouseState, inRows) => (
                <LinesConnectingMatrixToGenomicPosition
                  model={model}
                  crosshairX={inRows ? mouseState?.x : undefined}
                />
              )}
            </PointerLayer>
          )}
          <RowsPanel
            model={model}
            testIdPrefix={genomic ? 'variant' : 'variant-matrix'}
          >
            {genomic ? (
              <VariantBody model={model} canvasRef={canvasRef} />
            ) : (
              <MatrixBodyOffset model={model}>
                <VariantMatrixBody model={model} canvasRef={canvasRef} />
              </MatrixBodyOffset>
            )}
            <VariantRowSeparators model={model} />
          </RowsPanel>
          {/* Crosshairs only over the rows. The lane's marks are hoverable, so
              the genomic layout keeps the tooltip above them. */}
          <PointerLayer
            mouseTracker={mouseTracker}
            rowsTopOffset={rowsTopOffset}
          >
            {(mouseState, inRows) =>
              mouseState && (genomic || inRows) ? (
                <Crosshair
                  mouseState={mouseState}
                  model={model}
                  crosshairs={inRows}
                />
              ) : null
            }
          </PointerLayer>
          <ConfigProblemsCorner model={model} />
          <DisplayContextMenu model={model} />
        </>
      )}
    </DisplayChrome>
  )
})

export default VariantDisplayComponent
