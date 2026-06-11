import { observer } from 'mobx-react'

import { computeSashimiArcsFromModel, sashimiArcKey } from './sashimiArcs.ts'

import type { LinearAlignmentsDisplayModel } from './useAlignmentsBase.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// Static sashimi arcs for SVG export — same geometry as SashimiArcsOverlay,
// minus the hover/click handlers.
const SashimiArcsSvg = observer(function SashimiArcsSvg({
  model,
  view,
}: {
  model: LinearAlignmentsDisplayModel
  view: LinearGenomeViewModel
}) {
  const arcs = computeSashimiArcsFromModel(model, view, model.laidOutPileupMap)
  return arcs.length ? (
    <g transform={`translate(0,${model.sashimiArcsTop})`}>
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
})

export default SashimiArcsSvg
