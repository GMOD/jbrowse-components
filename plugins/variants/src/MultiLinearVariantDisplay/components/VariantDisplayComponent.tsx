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
  const ref = useRef<HTMLDivElement>(null)
  const { mouseState, handleMouseMove, handleMouseLeave } =
    useMouseTracking(ref)

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <TreeSidebar model={model} />
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
        }}
      >
        <BaseLinearDisplayComponent {...props} />
      </div>
      <LegendBar model={model} />

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
