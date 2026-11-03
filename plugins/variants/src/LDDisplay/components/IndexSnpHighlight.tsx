import { observer } from 'mobx-react'

import { indexArmColumns } from './indexArms.ts'

import type { LDDisplayModel } from '../model.ts'

// Emphasizes the index SNP's LD row+column: every pairwise cell involving the
// index SNP lies on the two diagonal lines meeting at its diagonal apex, so a
// translucent band along those lines (matching cell size) highlights exactly
// the index SNP's LD with all others (LocusZoom-style lead-variant view).
const IndexSnpHighlight = observer(function IndexSnpHighlight({
  model,
}: {
  model: LDDisplayModel
}) {
  const { rpcData, viewTransform, indexSnpColumn: f, height } = model
  if (!rpcData || f < 0 || f + 1 >= rpcData.boundaries.length) {
    return null
  }
  const { boundaries, band } = rpcData
  const n = boundaries.length - 1
  const { first, last } = indexArmColumns(f, n, band)

  const fCenter = (boundaries[f]! + boundaries[f + 1]!) / 2
  const apex = model.cellToScreen(fCenter, fCenter)
  // Row cells (f, j<f) fan down-left; column cells (i>f, f) fan down-right.
  const rowEnd =
    first < f
      ? model.cellToScreen(
          (boundaries[first]! + boundaries[first + 1]!) / 2,
          fCenter,
        )
      : apex
  const colEnd =
    last > f
      ? model.cellToScreen(
          fCenter,
          (boundaries[last]! + boundaries[last + 1]!) / 2,
        )
      : apex
  const strokeWidth = Math.min(
    40,
    Math.max(
      4,
      (boundaries[f + 1]! - boundaries[f]!) * viewTransform.viewScale,
    ),
  )

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
        d={`M ${rowEnd.x} ${rowEnd.y} L ${apex.x} ${apex.y} L ${colEnd.x} ${colEnd.y}`}
        stroke="rgba(255,170,0,0.35)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx={apex.x} cy={apex.y} r={4} fill="#e69500" />
    </svg>
  )
})

export default IndexSnpHighlight
