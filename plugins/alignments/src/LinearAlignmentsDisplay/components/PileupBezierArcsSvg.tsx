import { observer } from 'mobx-react'

import { bezierArcKey } from '../../features/linkedReads/computeOverlay.ts'
import {
  BEZIER_ARC_STROKE_OPACITY,
  BEZIER_ARC_STROKE_WIDTH,
  computePileupBezierArcsFromModel,
} from './pileupBezierArcs.ts'

import type { LinearAlignmentsDisplayModel } from './useAlignmentsBase.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// Static linked-read bezier arcs for SVG export — same geometry as
// PileupBezierOverlay, minus the hover/click handlers. Full height, scrollTop 0.
const PileupBezierArcsSvg = observer(function PileupBezierArcsSvg({
  model,
  view,
}: {
  model: LinearAlignmentsDisplayModel
  view: LinearGenomeViewModel
}) {
  const arcs = computePileupBezierArcsFromModel(model, view, 0)
  return arcs.length ? (
    <g style={{ pointerEvents: 'none' }}>
      {arcs.map(arc => (
        <path
          key={bezierArcKey(arc)}
          d={arc.d}
          stroke={arc.stroke}
          strokeWidth={BEZIER_ARC_STROKE_WIDTH}
          strokeOpacity={BEZIER_ARC_STROKE_OPACITY}
          fill="none"
        />
      ))}
    </g>
  ) : null
})

export default PileupBezierArcsSvg
