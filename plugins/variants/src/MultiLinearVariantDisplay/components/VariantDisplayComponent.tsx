import { useRef } from 'react'

import { FloatingLegend } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import Crosshair from '../../shared/components/MultiVariantCrosshairs'
import ScrollableVariantContainer from '../../shared/components/ScrollableVariantContainer'
import { useMouseTracking } from '../../shared/hooks/useMouseTracking'

import type { MultiLinearVariantDisplayModel } from '../model'

const MultiLinearVariantDisplayComponent = observer(
  function MultiLinearVariantDisplayComponent(props: {
    model: MultiLinearVariantDisplayModel
  }) {
    const { model } = props
    const { height, showLegend } = model
    const legendItems = model.legendItems()
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
        <ScrollableVariantContainer model={model} />

        {mouseState ? (
          <Crosshair
            mouseX={mouseState.x}
            mouseY={mouseState.y}
            offsetX={mouseState.offsetX}
            offsetY={mouseState.offsetY}
            model={model}
          />
        ) : null}

        {showLegend && legendItems.length > 0 ? (
          <FloatingLegend items={legendItems} />
        ) : null}
      </div>
    )
  },
)

export default MultiLinearVariantDisplayComponent
