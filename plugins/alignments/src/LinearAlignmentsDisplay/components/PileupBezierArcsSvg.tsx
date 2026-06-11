import { observer } from 'mobx-react'

import { computePileupBezierArcsFromModel } from './pileupBezierArcs.ts'

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
          key={`${arc.id1}:${arc.id2}`}
          d={arc.d}
          stroke={arc.stroke}
          strokeWidth={1.5}
          strokeOpacity={0.8}
          fill="none"
        />
      ))}
    </g>
  ) : null
})

export default PileupBezierArcsSvg
