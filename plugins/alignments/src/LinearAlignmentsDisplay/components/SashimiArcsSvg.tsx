import { observer } from 'mobx-react'

import SashimiArcLabels from './SashimiArcLabels.tsx'
import { SASHIMI_SIDES, sashimiArcKey, sashimiSideTop } from './sashimiArcs.ts'

import type { SashimiArc } from '../../features/sashimi/computeOverlay.ts'
import type { LinearAlignmentsDisplayModel } from './useAlignmentsBase.ts'

// One side's arcs translated to its sub-band's content-space top. Arc geometry
// is already band-local, so a single translate places the whole side. Paths
// first, labels second, so a count is never buried under a neighbouring arc's
// stroke.
function SashimiSide({
  arcs,
  top,
  showLabels,
}: {
  arcs: SashimiArc[]
  top: number
  showLabels: boolean
}) {
  return arcs.length ? (
    <g transform={`translate(0,${top})`}>
      {arcs.map(arc => (
        <path
          key={sashimiArcKey(arc)}
          d={arc.d}
          stroke={arc.stroke}
          strokeWidth={arc.strokeWidth}
          fill="none"
        />
      ))}
      <SashimiArcLabels arcs={arcs} show={showLabels} />
    </g>
  ) : null
}

// Static sashimi arcs for SVG export — the very same `sashimiArcSections`
// geometry the on-screen overlay renders, minus the hover/click handlers. Export
// shows the full (unscrolled) height, so each section's bands sit at their
// content-space tops.
const SashimiArcsSvg = observer(function SashimiArcsSvg({
  model,
}: {
  model: LinearAlignmentsDisplayModel
}) {
  return model.sashimiArcSections.flatMap(section =>
    SASHIMI_SIDES.map(side => (
      <SashimiSide
        key={`${section.groupKey}-${side}`}
        arcs={section[side]}
        top={sashimiSideTop(section, side)}
        showLabels={model.showSashimiLabels}
      />
    )),
  )
})

export default SashimiArcsSvg
