import { useRef, useState } from 'react'

import { BaseLinearDisplayComponent } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import LinesConnectingMatrixToGenomicPosition from './LinesConnectingMatrixToGenomicPosition'
import Crosshair from '../../shared/components/MultiVariantCrosshairs'
import LegendBar from '../../shared/components/MultiVariantLegendBar'
import TreeSidebar from '../../shared/components/TreeSidebar'

import type { MultiLinearVariantMatrixDisplayModel } from '../model'

const MultiLinearVariantMatrixDisplayComponent = observer(function (props: {
  model: MultiLinearVariantMatrixDisplayModel
}) {
  const { model } = props
  const { lineZoneHeight, height, setScrollTop, autoHeight, scrollTop } = model
  const ref = useRef<HTMLDivElement>(null)
  const [mouseY, setMouseY] = useState<number>()
  const [mouseX, setMouseX] = useState<number>()
  const matrixHeight = height - lineZoneHeight

  return (
    <div
      ref={ref}
      style={{ position: 'relative', height }}
      onMouseMove={event => {
        const rect = ref.current?.getBoundingClientRect()
        const top = rect?.top || 0
        const left = rect?.left || 0
        setMouseY(event.clientY - top)
        setMouseX(event.clientX - left)
      }}
      onMouseLeave={() => {
        setMouseY(undefined)
        setMouseX(undefined)
      }}
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
          height: matrixHeight,
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
            top: autoHeight ? 0 : scrollTop,
            left: 0,
            width: '100%',
          }}
        >
          <BaseLinearDisplayComponent {...props} />
        </div>
      </div>

      {mouseX && mouseY && mouseY > lineZoneHeight ? (
        <Crosshair mouseX={mouseX} mouseY={mouseY} model={model} />
      ) : null}
    </div>
  )
})
export default MultiLinearVariantMatrixDisplayComponent
