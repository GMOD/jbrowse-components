import { useRef } from 'react'

import { useMouseState, useMouseTracking } from '@jbrowse/core/ui'
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

// Both pointer-driven pieces below read the tracker themselves, so a mousemove
// re-renders them alone rather than `DisplayChrome` and every overlay under it
// — see `useMouseTracking`. They share one definition of "the cursor is in the
// matrix rather than the line zone above it"; `lineZoneHeight` arrives as a
// prop because these are plain components, and the observer above already
// tracks it.
function useMatrixMouseState(
  mouseTracker: MouseTracker,
  lineZoneHeight: number,
) {
  const mouseState = useMouseState(mouseTracker)
  return mouseState && mouseState.y > lineZoneHeight ? mouseState : undefined
}

function MatrixConnectingLines({
  model,
  mouseTracker,
  lineZoneHeight,
}: {
  model: LinearMultiSampleVariantMatrixDisplayModel
  mouseTracker: MouseTracker
  lineZoneHeight: number
}) {
  const inMatrix = useMatrixMouseState(mouseTracker, lineZoneHeight)
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
  lineZoneHeight,
}: {
  model: LinearMultiSampleVariantMatrixDisplayModel
  mouseTracker: MouseTracker
  lineZoneHeight: number
}) {
  const inMatrix = useMatrixMouseState(mouseTracker, lineZoneHeight)
  return inMatrix ? <Crosshair mouseState={inMatrix} model={model} /> : null
}

const VariantMatrixDisplayComponent = observer(
  function VariantMatrixDisplayComponent(props: {
    model: LinearMultiSampleVariantMatrixDisplayModel
  }) {
    const { model } = props
    const { lineZoneHeight, height } = model
    const view = getContainingView(model) as LinearGenomeViewModel
    const left = Math.max(0, -view.offsetPx)
    const ref = useRef<HTMLDivElement>(null)
    const { mouseTracker, handleMouseMove, handleMouseLeave } =
      useMouseTracking(ref)

    return (
      <DisplayChrome
        model={model}
        factory={VariantMatrixRenderer}
        ref={ref}
        testid="variant-matrix-display"
        style={{ height }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {({ canvasRef, canvas }) => (
          <>
            <MatrixConnectingLines
              model={model}
              mouseTracker={mouseTracker}
              lineZoneHeight={lineZoneHeight}
            />
            <div style={{ position: 'absolute', top: lineZoneHeight, left }}>
              <VariantMatrixBody
                model={model}
                canvasRef={canvasRef}
                canvas={canvas}
              />
            </div>
            <VariantOverlay model={model} top={lineZoneHeight} />
            <TreeSidebar model={model} />
            <MatrixCrosshairLayer
              model={model}
              mouseTracker={mouseTracker}
              lineZoneHeight={lineZoneHeight}
            />
          </>
        )}
      </DisplayChrome>
    )
  },
)

export default VariantMatrixDisplayComponent
