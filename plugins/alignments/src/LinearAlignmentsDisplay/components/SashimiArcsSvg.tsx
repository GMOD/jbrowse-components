import { observer } from 'mobx-react'

import SashimiArcLabel from './SashimiArcLabel.tsx'
import { computeSashimiArcsFromModel, sashimiArcKey } from './sashimiArcs.ts'

import type { LinearAlignmentsDisplayModel } from './useAlignmentsBase.ts'
import type { SashimiArc } from '../../features/sashimi/computeOverlay.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

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
          <path d={arc.d} stroke={arc.stroke} strokeWidth={arc.strokeWidth} fill="none" />
          {arc.showLabel && showLabels ? (
            <SashimiArcLabel x={arc.labelX} y={arc.labelY} score={arc.score} />
          ) : null}
        </g>
      ))}
    </g>
  ) : null
}

// Static sashimi arcs for SVG export — same per-section geometry as
// SashimiArcsOverlay, minus the hover/click handlers. Export shows the full
// (unscrolled) height, so each section's bands sit at their content-space tops.
const SashimiArcsSvg = observer(function SashimiArcsSvg({
  model,
  view,
}: {
  model: LinearAlignmentsDisplayModel
  view: LinearGenomeViewModel
}) {
  return (
    <>
      {model.sashimiSections.map(section => {
        const arcs = computeSashimiArcsFromModel(model, view, section.rpcDataMap)
        return arcs.length ? (
          <g key={section.groupKey}>
            <SashimiSide
              arcs={arcs.filter(a => a.side === 'up')}
              top={section.coverageOverlayTop}
              showLabels={model.showSashimiLabels}
            />
            <SashimiSide
              arcs={arcs.filter(a => a.side === 'down')}
              top={section.sashimiBandTop}
              showLabels={model.showSashimiLabels}
            />
          </g>
        ) : null
      })}
    </>
  )
})

export default SashimiArcsSvg
