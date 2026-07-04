import { useState } from 'react'

import { getContainingView } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { computePileupBezierArcsFromModel } from './pileupBezierArcs.ts'

import type { LinearAlignmentsDisplayModel } from './useAlignmentsBase.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

function arcTooltip(
  model: LinearAlignmentsDisplayModel,
  label: string,
  id1: string,
  id2: string,
) {
  const parts: string[] = []
  for (const id of [id1, id2]) {
    const info = model.getFeatureInfoById(id)
    if (info) {
      parts.push(
        `${info.name || info.id} ${info.refName}:${info.start.toLocaleString()}-${info.end.toLocaleString()}`,
      )
    }
  }
  return parts.length > 0 ? `${label}: ${parts.join(' → ')}` : label
}

const PileupBezierOverlay = observer(function PileupBezierOverlay({
  model,
}: {
  model: LinearAlignmentsDisplayModel
}) {
  const [selectedArcId, setSelectedArcId] = useState<string | null>(null)
  const view = getContainingView(model) as LinearGenomeViewModel
  const { showBezierConnections, scrollTop, height } = model
  const { initialized, width } = view

  if (!showBezierConnections || !initialized) {
    return null
  }

  const arcs = computePileupBezierArcsFromModel(model, view, scrollTop)

  if (!arcs.length) {
    return null
  }

  return (
    <svg
      data-testid="pileup-bezier-overlay"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        height,
        width,
        overflow: 'visible',
      }}
    >
      {arcs.map(arc => {
        const arcId = `${arc.id1}:${arc.id2}`
        const isSelected = arcId === selectedArcId
        return (
          <path
            key={arcId}
            data-testid="pileup-bezier-arc"
            d={arc.d}
            stroke={arc.stroke}
            strokeWidth={isSelected ? 5 : 1}
            strokeOpacity={0.8}
            fill="none"
            style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
            onMouseEnter={() => {
              const tooltip = arcTooltip(model, arc.label, arc.id1, arc.id2)
              if (tooltip) {
                model.setMouseoverExtraInformation(tooltip)
              }
            }}
            onMouseLeave={() => {
              model.clearMouseoverState()
            }}
            onClick={() => {
              setSelectedArcId(isSelected ? null : arcId)
              void model.selectFeatureById(arc.id1)
            }}
          />
        )
      })}
    </svg>
  )
})

export default PileupBezierOverlay
