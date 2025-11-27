import { useRef } from 'react'

import { BaseLinearDisplayComponent } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import LinesConnectingMatrixToGenomicPosition from './LinesConnectingMatrixToGenomicPosition'
import Crosshair from '../../shared/components/MultiVariantCrosshairs'
import LegendBar from '../../shared/components/MultiVariantLegendBar'
import TreeSidebar from '../../shared/components/TreeSidebar'
import { useMouseTracking } from '../../shared/hooks/useMouseTracking'

import type { MultiLinearVariantMatrixDisplayModel } from '../model'

const MultiLinearVariantMatrixDisplayComponent = observer(function (props: {
  model: MultiLinearVariantMatrixDisplayModel
}) {
  const { model } = props
  const {
    lineZoneHeight,
    height,
    setScrollTop,
    autoHeight,
    scrollTop,
    availableHeight,
  } = model
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

      {/* Matrix display - scrollable container */}
      <div
        data-testid="matrix-display"
        style={{
          position: 'absolute',
          top: lineZoneHeight,
          height: availableHeight,
          width: '100%',
          overflowY: autoHeight ? 'hidden' : 'auto',
          overflowX: 'hidden',
        }}
        onScroll={evt => {
          setScrollTop(evt.currentTarget.scrollTop)
        }}
      >
        <TreeSidebar model={model} />
        <LegendBar model={model} />
        <div
          style={{
            position: 'absolute',
            // top: autoHeight ? 0 : scrollTop,
            left: 0,
            width: '100%',
          }}
        >
          <BaseLinearDisplayComponent {...props} />
        </div>
      </div>

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
})
export default MultiLinearVariantMatrixDisplayComponent
