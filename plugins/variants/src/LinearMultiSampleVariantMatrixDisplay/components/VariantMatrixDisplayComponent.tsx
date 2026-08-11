import { useMouseState } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import { DisplayChrome } from '@jbrowse/plugin-linear-genome-view'
import { TreeSidebar } from '@jbrowse/tree-sidebar'
import { observer } from 'mobx-react'

import Crosshair from '../../shared/components/MultiSampleVariantCrosshairs.tsx'
import VariantOverlay from '../../shared/components/MultiSampleVariantOverlay.tsx'
import LinesConnectingMatrixToGenomicPosition from './LinesConnectingMatrixToGenomicPosition.tsx'
import VariantMatrixBody from './VariantMatrixComponent.tsx'
import { VariantMatrixRenderer } from './VariantMatrixRenderer.ts'

import type { LinearMultiSampleVariantMatrixDisplayModel } from '../model.ts'
import type { MouseTracker } from '@jbrowse/core/ui'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type { ReactNode } from 'react'

// Both pointer-driven pieces below read the tracker themselves, so a mousemove
// re-renders them alone rather than `DisplayChrome` and every overlay under it
// — see `useMouseTracking`. They share one definition of "the cursor is in the
// matrix rather than in the bands above it"; `rowsTopOffset` arrives as a prop
// because these are plain components, and the observer above already tracks it.
//
// `rowsTopOffset` and not `lineZoneHeight`: the connector zone is the only band
// this display currently stacks, so the two are equal here — but the offset the
// rows actually begin at is the total, and reaching for one band's height as if
// it were that total is what `shared/variantTopBands.ts` exists to stop.
function useMatrixMouseState(
  mouseTracker: MouseTracker,
  rowsTopOffset: number,
) {
  const mouseState = useMouseState(mouseTracker)
  return mouseState && mouseState.y > rowsTopOffset ? mouseState : undefined
}

function MatrixConnectingLines({
  model,
  mouseTracker,
  rowsTopOffset,
}: {
  model: LinearMultiSampleVariantMatrixDisplayModel
  mouseTracker: MouseTracker
  rowsTopOffset: number
}) {
  const inMatrix = useMatrixMouseState(mouseTracker, rowsTopOffset)
  return (
    <LinesConnectingMatrixToGenomicPosition
      model={model}
      crosshairX={inMatrix?.x}
    />
  )
}

function MatrixCrosshairLayer({
  model,
  mouseTracker,
  rowsTopOffset,
}: {
  model: LinearMultiSampleVariantMatrixDisplayModel
  mouseTracker: MouseTracker
  rowsTopOffset: number
}) {
  const inMatrix = useMatrixMouseState(mouseTracker, rowsTopOffset)
  return inMatrix ? <Crosshair mouseState={inMatrix} model={model} /> : null
}

// The matrix's own box, offset past the bands above the rows and clamped to the
// viewport's left edge.
//
// Its own observer purely so `offsetPx` is read HERE. It moves every frame of a
// pan, and read in the component that mounts `DisplayChrome` it re-rendered the
// chrome for the whole of every drag — `useRenderingBackend` re-run, the status
// container rebuilt with a fresh inline `style`, the overlay portal re-created —
// to move one div. The body inside is passed as `children`, so it is an element
// built by the caller and re-renders on its own terms.
const MatrixBodyOffset = observer(function MatrixBodyOffset({
  model,
  top,
  children,
}: {
  model: LinearMultiSampleVariantMatrixDisplayModel
  top: number
  children: ReactNode
}) {
  const view = getContainingView(model) as LinearGenomeViewModel
  return (
    <div
      style={{
        position: 'absolute',
        top,
        left: Math.max(0, -view.offsetPx),
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
    return (
      <DisplayChrome
        model={model}
        factory={VariantMatrixRenderer}
        testid="variant-matrix-display"
        style={{ height }}
      >
        {({ canvasRef, canvas, mouseTracker }) => (
          <>
            <MatrixConnectingLines
              model={model}
              mouseTracker={mouseTracker}
              rowsTopOffset={rowsTopOffset}
            />
            <MatrixBodyOffset model={model} top={rowsTopOffset}>
              <VariantMatrixBody
                model={model}
                canvasRef={canvasRef}
                canvas={canvas}
              />
            </MatrixBodyOffset>
            <VariantOverlay model={model} top={rowsTopOffset} />
            <TreeSidebar model={model} />
            <MatrixCrosshairLayer
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

export default VariantMatrixDisplayComponent
