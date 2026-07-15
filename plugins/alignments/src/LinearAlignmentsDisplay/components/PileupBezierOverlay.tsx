import { useState } from 'react'

import { getContainingView } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import {
  BEZIER_ARC_STROKE_OPACITY,
  BEZIER_ARC_STROKE_WIDTH,
  computePileupBezierArcsFromModel,
} from './pileupBezierArcs.ts'
import { bezierArcKey } from '../../features/linkedReads/computeOverlay.ts'

import type { LinearAlignmentsDisplayModel } from './useAlignmentsBase.ts'
import type { PileupArc } from '../../features/linkedReads/computeOverlay.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// Takes the whole arc rather than positional (label, id1, id2) so the two ids
// can't be transposed at the call site.
function arcTooltip(
  model: LinearAlignmentsDisplayModel,
  arc: Pick<PileupArc, 'label' | 'id1' | 'id2'>,
) {
  const parts: string[] = []
  for (const id of [arc.id1, arc.id2]) {
    const info = model.getFeatureInfoById(id)
    if (info) {
      parts.push(
        `${info.name || info.id} ${info.refName}:${info.start.toLocaleString()}-${info.end.toLocaleString()}`,
      )
    }
  }
  return parts.length > 0 ? `${arc.label}: ${parts.join(' → ')}` : arc.label
}

const PileupBezierOverlay = observer(function PileupBezierOverlay({
  model,
}: {
  model: LinearAlignmentsDisplayModel
}) {
  const [selectedArcId, setSelectedArcId] = useState<string | null>(null)
  const [hoveredArcId, setHoveredArcId] = useState<string | null>(null)
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

  // Paint an emphasized (hovered/selected) curve last so a thin crossing curve
  // can't sit on top of it. The base order is otherwise preserved.
  const emphasis = (arc: PileupArc) => {
    const id = bezierArcKey(arc)
    return id === hoveredArcId || id === selectedArcId ? 1 : 0
  }
  const ordered = [...arcs].sort((a, b) => emphasis(a) - emphasis(b))

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
      {ordered.map(arc => {
        const arcId = bezierArcKey(arc)
        const isSelected = arcId === selectedArcId
        const isHovered = arcId === hoveredArcId
        return (
          <path
            key={arcId}
            data-testid="pileup-bezier-arc"
            d={arc.d}
            stroke={arc.stroke}
            strokeWidth={
              isSelected ? 5 : isHovered ? 3 : BEZIER_ARC_STROKE_WIDTH
            }
            strokeOpacity={isHovered ? 1 : BEZIER_ARC_STROKE_OPACITY}
            fill="none"
            style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
            onMouseEnter={() => {
              setHoveredArcId(arcId)
              const tooltip = arcTooltip(model, arc)
              if (tooltip) {
                model.setMouseoverExtraInformation(tooltip)
              }
            }}
            onMouseLeave={() => {
              setHoveredArcId(prev => (prev === arcId ? null : prev))
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
