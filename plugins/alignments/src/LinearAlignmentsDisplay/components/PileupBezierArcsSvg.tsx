import { bezierArcKey } from '../../features/linkedReads/computeOverlay.ts'
import {
  BEZIER_ARC_STROKE_OPACITY,
  BEZIER_ARC_STROKE_WIDTH,
  computePileupBezierArcsFromModel,
} from './pileupBezierArcs.ts'

import type { LinearAlignmentsDisplayModel } from './useAlignmentsBase.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// Static linked-read bezier arcs for SVG export — same geometry as
// PileupBezierOverlay, minus the hover/click handlers, and now at the same
// scrollTop: the arcs connect reads, so pinning them to 0 while the reads
// scrolled left them hanging off the wrong rows.
//
// Not an observer, for the reason `SashimiArcsSvg` states: the geometry is
// built from `view.offsetPx`/`bpPerPx`, so subscribing slid these arcs across
// a frozen figure's reads on every pan.
export default function PileupBezierArcsSvg({
  model,
  view,
}: {
  model: LinearAlignmentsDisplayModel
  view: LinearGenomeViewModel
}) {
  const arcs = computePileupBezierArcsFromModel(model, view)
  return arcs.length ? (
    <g style={{ pointerEvents: 'none' }}>
      {arcs.map(arc => (
        <path
          key={bezierArcKey(arc)}
          d={arc.d}
          stroke={arc.stroke}
          strokeWidth={BEZIER_ARC_STROKE_WIDTH}
          strokeOpacity={BEZIER_ARC_STROKE_OPACITY}
          // Exported dashed too: the export is the same geometry from the same
          // seam, and a junction across unfetched segments reads as a solid
          // inversion in a figure exactly as it does on screen.
          strokeDasharray={arc.dash}
          fill="none"
        />
      ))}
    </g>
  ) : null
}
