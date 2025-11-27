import { useRef } from 'react'

import { BaseLinearDisplayComponent } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import Crosshair from '../../shared/components/MultiVariantCrosshairs'
import LegendBar from '../../shared/components/MultiVariantLegendBar'
import TreeSidebar from '../../shared/components/TreeSidebar'
import { useMouseTracking } from '../../shared/hooks/useMouseTracking'

import type { MultiLinearVariantDisplayModel } from '../model'

const MultiLinearVariantDisplayComponent = observer(function (props: {
  model: MultiLinearVariantDisplayModel
}) {
  const { model } = props
  const { height, setScrollTop, autoHeight, availableHeight } = model
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
      {/* Scrollable container for display content */}
      <div
        style={{
          position: 'absolute',
          top: 0,
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
            left: 0,
            width: '100%',
          }}
        >
          <BaseLinearDisplayComponent {...props} />
        </div>
      </div>

      {mouseState ? (
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

export default MultiLinearVariantDisplayComponent
