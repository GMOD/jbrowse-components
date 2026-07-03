import { getContainingView } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import type { SharedLDModel } from '../shared.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const SQRT2 = Math.SQRT2

// Emphasizes the focal SNP's LD row+column: every pairwise cell involving the
// focal SNP lies on the two diagonal lines meeting at its diagonal apex, so a
// translucent band along those lines (matching cell size) highlights exactly
// the focal SNP's LD with all others (LocusZoom-style lead-variant view).
const FocalSnpHighlight = observer(function FocalSnpHighlight({
  model,
  height,
}: {
  model: SharedLDModel
  height: number
}) {
  const view = getContainingView(model) as LinearGenomeViewModel
  const {
    rpcData,
    yScalar,
    effectiveLineZoneHeight,
    renderTransform,
    focalSnpIndex: f,
  } = model
  const boundaries = rpcData?.boundaries
  if (!boundaries || f < 0 || f + 1 >= boundaries.length) {
    return null
  }
  const n = boundaries.length - 1
  const { scale: viewScale, viewOffsetX } = renderTransform
  const toScreen = (x: number, y: number) => ({
    x: ((x + y) / SQRT2) * viewScale + viewOffsetX,
    y: ((y - x) / SQRT2) * viewScale * yScalar + effectiveLineZoneHeight,
  })

  const fCenter = (boundaries[f]! + boundaries[f + 1]!) / 2
  const apex = toScreen(fCenter, fCenter)
  // Row cells (f, j<f) fan down-left; column cells (i>f, f) fan down-right.
  const rowEnd =
    f > 0 ? toScreen((boundaries[0]! + boundaries[1]!) / 2, fCenter) : apex
  const colEnd =
    f < n - 1
      ? toScreen(fCenter, (boundaries[n - 1]! + boundaries[n]!) / 2)
      : apex
  const strokeWidth = Math.min(
    40,
    Math.max(4, (boundaries[f + 1]! - boundaries[f]!) * viewScale),
  )

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

export default FocalSnpHighlight
