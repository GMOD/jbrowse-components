import { getContainingView } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import type { LDFlatbushItem } from '../../RenderLDDataRPC/types.ts'
import type { SharedLDModel } from '../shared.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const SQRT2 = Math.SQRT2

const Crosshairs = observer(function Crosshairs({
  model,
  hoveredItem,
  genomicX1,
  genomicX2,
  height,
}: {
  model: SharedLDModel
  hoveredItem: LDFlatbushItem
  genomicX1: number
  genomicX2: number
  height: number
}) {
  const view = getContainingView(model) as LinearGenomeViewModel
  const {
    rpcData,
    yScalar,
    effectiveLineZoneHeight,
    tickHeight,
    useGenomicPositions,
    renderTransform,
  } = model
  const boundaries = rpcData?.boundaries
  const { i, j } = hoveredItem
  if (!boundaries || i + 1 >= boundaries.length || j + 1 >= boundaries.length) {
    return null
  }

  const { scale: viewScale, viewOffsetX } = renderTransform
  const toScreen = (x: number, y: number) => ({
    x: ((x + y) / SQRT2) * viewScale + viewOffsetX,
    y: ((y - x) / SQRT2) * viewScale * yScalar + effectiveLineZoneHeight,
  })

  const jCenter = (boundaries[j]! + boundaries[j + 1]!) / 2
  const iCenter = (boundaries[i]! + boundaries[i + 1]!) / 2
  const hoveredCenter = toScreen(jCenter, iCenter)
  const snpJPos = useGenomicPositions
    ? { x: genomicX1, y: effectiveLineZoneHeight }
    : toScreen(jCenter, jCenter)
  const snpIPos = useGenomicPositions
    ? { x: genomicX2, y: effectiveLineZoneHeight }
    : toScreen(iCenter, iCenter)

  return (
    <svg
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: view.totalWidthPxWithoutBorders,
        height,
        pointerEvents: 'none',
      }}
    >
      <path
        stroke="rgba(0, 0, 0, 0.6)"
        strokeWidth={1}
        fill="none"
        d={`M ${snpJPos.x} ${snpJPos.y} L ${hoveredCenter.x} ${hoveredCenter.y} L ${snpIPos.x} ${snpIPos.y}`}
      />
      <g stroke="#e00" strokeWidth="1.5" fill="none">
        {useGenomicPositions ? null : (
          <>
            <path
              d={`M ${snpJPos.x} ${snpJPos.y} L ${genomicX1} ${tickHeight}`}
            />
            <path
              d={`M ${snpIPos.x} ${snpIPos.y} L ${genomicX2} ${tickHeight}`}
            />
          </>
        )}
        <path d={`M ${genomicX1} 0 L ${genomicX1} ${tickHeight}`} />
        <path d={`M ${genomicX2} 0 L ${genomicX2} ${tickHeight}`} />
      </g>
    </svg>
  )
})

export default Crosshairs
