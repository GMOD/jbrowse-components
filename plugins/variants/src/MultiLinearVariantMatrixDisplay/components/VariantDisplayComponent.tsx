import { useRef } from 'react'

import { observer } from 'mobx-react'

import LinesConnectingMatrixToGenomicPosition from './LinesConnectingMatrixToGenomicPosition.tsx'
import Crosshair from '../../shared/components/MultiVariantCrosshairs.tsx'
import ScrollableVariantContainer from '../../shared/components/ScrollableVariantContainer.tsx'
import { useMouseTracking } from '../../shared/hooks/useMouseTracking.ts'

import type { MultiLinearVariantMatrixDisplayModel } from '../model.ts'

const MultiLinearVariantMatrixDisplayComponent = observer(
  function MultiLinearVariantMatrixDisplayComponent(props: {
    model: MultiLinearVariantMatrixDisplayModel
  }) {
    const { model } = props
    const { lineZoneHeight, height } = model
    const ref = useRef<HTMLDivElement>(null)
    const { mouseState, handleMouseMove, handleMouseLeave } =
      useMouseTracking(ref)

    return (
      <div
        ref={ref}
        style={{ position: 'relative', height }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Connecting lines - fixed at top */}
        <div data-testid="connecting-lines">
          <LinesConnectingMatrixToGenomicPosition model={model} />
        </div>

        <ScrollableVariantContainer
          model={model}
          topOffset={lineZoneHeight}
          testId="matrix-display"
        />

        {mouseState && mouseState.y > lineZoneHeight ? (
          <Crosshair
            mouseX={mouseState.x}
            mouseY={mouseState.y}
            offsetX={mouseState.offsetX}
            offsetY={mouseState.offsetY}
            model={model}
          />
        ) : null}
      </div>
    )
  },
)
export default MultiLinearVariantMatrixDisplayComponent
