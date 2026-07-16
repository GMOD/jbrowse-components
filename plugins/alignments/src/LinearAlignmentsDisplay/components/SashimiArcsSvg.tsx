import { observer } from 'mobx-react'

import SashimiArcLabel from './SashimiArcLabel.tsx'
import { sashimiArcKey } from './sashimiArcs.ts'

import type { LinearAlignmentsDisplayModel } from './useAlignmentsBase.ts'
import type { SashimiArc } from '../../features/sashimi/computeOverlay.ts'

// One side's arcs translated to its sub-band's content-space top. Arc geometry
// is already band-local, so a single translate places the whole side.
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
        <g key={sashimiArcKey(arc)}>
          <path
            d={arc.d}
            stroke={arc.stroke}
            strokeWidth={arc.strokeWidth}
            fill="none"
          />
          {arc.showLabel && showLabels ? (
            <SashimiArcLabel x={arc.labelX} y={arc.labelY} score={arc.score} />
          ) : null}
        </g>
      ))}
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
  return (
    <>
      {model.sashimiArcSections.map(section => (
        <g key={section.groupKey}>
          <SashimiSide
            arcs={section.up}
            top={section.coverageOverlayTop}
            showLabels={model.showSashimiLabels}
          />
          <SashimiSide
            arcs={section.down}
            top={section.sashimiBandTop}
            showLabels={model.showSashimiLabels}
          />
        </g>
      ))}
    </>
  )
})

export default SashimiArcsSvg
