import { observer } from 'mobx-react'

import { computeSashimiArcsFromModel, sashimiArcKey } from './sashimiArcs.ts'

import type { LinearAlignmentsDisplayModel } from './useAlignmentsBase.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// Static sashimi arcs for SVG export — same per-section geometry as
// SashimiArcsOverlay, minus the hover/click handlers. Export shows the full
// (unscrolled) height, so each section's band sits at its content-space top.
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
          <g key={section.groupKey} transform={`translate(0,${section.top})`}>
            {arcs.map(arc => (
              <path
                key={sashimiArcKey(arc)}
                d={arc.d}
                stroke={arc.stroke}
                strokeWidth={arc.strokeWidth}
                fill="none"
              />
            ))}
          </g>
        ) : null
      })}
    </>
  )
})

export default SashimiArcsSvg
