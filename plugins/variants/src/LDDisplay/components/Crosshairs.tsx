import { observer } from 'mobx-react'

import type { LDFlatbushItem } from '../../RenderLDDataRPC/types.ts'
import type { SharedLDModel } from '../shared.ts'

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
  const {
    rpcData,
    effectiveLineZoneHeight,
    tickHeight,
    effectiveUseGenomicPositions,
  } = model
  const boundaries = rpcData?.boundaries
  const { i, j } = hoveredItem
  if (!boundaries || i + 1 >= boundaries.length || j + 1 >= boundaries.length) {
    return null
  }

  const jCenter = (boundaries[j]! + boundaries[j + 1]!) / 2
  const iCenter = (boundaries[i]! + boundaries[i + 1]!) / 2
  const hoveredCenter = model.cellToScreen(jCenter, iCenter)
  const snpJPos = effectiveUseGenomicPositions
    ? { x: genomicX1, y: effectiveLineZoneHeight }
    : model.cellToScreen(jCenter, jCenter)
  const snpIPos = effectiveUseGenomicPositions
    ? { x: genomicX2, y: effectiveLineZoneHeight }
    : model.cellToScreen(iCenter, iCenter)

  return (
    <svg
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: model.canvasWidth,
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
        {effectiveUseGenomicPositions ? null : (
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
