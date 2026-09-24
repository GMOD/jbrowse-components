import { observer } from 'mobx-react'

import type { LDCellHit } from '../../RenderLDDataRPC/types.ts'
import type { LDDisplayModel } from '../model.ts'

/**
 * The hovered cell tied to its two SNPs: along the diagonals to their columns'
 * apexes, then up to the ticks at their genomic x (`xJ`, `xI`). At genomic
 * positions the apexes already sit at the genomic x.
 */
const Crosshairs = observer(function Crosshairs({
  model,
  hoveredItem,
  xJ,
  xI,
}: {
  model: LDDisplayModel
  hoveredItem: LDCellHit
  xJ: number
  xI: number
}) {
  const {
    rpcData,
    matrixTop,
    tickHeight,
    effectiveUseGenomicPositions,
    canvasWidth,
    height,
  } = model
  const boundaries = rpcData?.boundaries
  const { i, j } = hoveredItem
  if (!boundaries || i + 1 >= boundaries.length || j + 1 >= boundaries.length) {
    return null
  }

  const jCenter = (boundaries[j]! + boundaries[j + 1]!) / 2
  const iCenter = (boundaries[i]! + boundaries[i + 1]!) / 2
  const hovered = model.cellToScreen(jCenter, iCenter)
  const snpJ = effectiveUseGenomicPositions
    ? { x: xJ, y: matrixTop }
    : model.cellToScreen(jCenter, jCenter)
  const snpI = effectiveUseGenomicPositions
    ? { x: xI, y: matrixTop }
    : model.cellToScreen(iCenter, iCenter)

  return (
    <svg
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: canvasWidth,
        height,
        pointerEvents: 'none',
      }}
    >
      <path
        stroke="rgba(0, 0, 0, 0.6)"
        strokeWidth={1}
        fill="none"
        d={`M ${snpJ.x} ${snpJ.y} L ${hovered.x} ${hovered.y} L ${snpI.x} ${snpI.y}`}
      />
      <g stroke="#e00" strokeWidth="1.5" fill="none">
        {effectiveUseGenomicPositions ? null : (
          <>
            <path d={`M ${snpJ.x} ${snpJ.y} L ${xJ} ${tickHeight}`} />
            <path d={`M ${snpI.x} ${snpI.y} L ${xI} ${tickHeight}`} />
          </>
        )}
        <path d={`M ${xJ} 0 L ${xJ} ${tickHeight}`} />
        <path d={`M ${xI} 0 L ${xI} ${tickHeight}`} />
      </g>
    </svg>
  )
})

export default Crosshairs
