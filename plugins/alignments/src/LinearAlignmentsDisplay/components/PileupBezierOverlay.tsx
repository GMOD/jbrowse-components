import { useState } from 'react'

import { getContainingView } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { bezierArcKey } from '../../features/linkedReads/computeOverlay.ts'
import {
  BEZIER_ARC_STROKE_OPACITY,
  BEZIER_ARC_STROKE_WIDTH,
  computePileupBezierArcsFromModel,
} from './pileupBezierArcs.ts'
import { formatFeatureLabel } from './tooltipUtils.ts'

import type { PileupArc } from '../../features/linkedReads/computeOverlay.ts'
import type { LinearAlignmentsDisplayModel } from './useAlignmentsBase.ts'
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
      parts.push(formatFeatureLabel(info))
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

  // `view.width` is read AFTER this gate, never destructured alongside
  // `initialized` above it: destructuring evaluates the getter, and `width`
  // throws by design before the view is measured — so `const { initialized,
  // width } = view` throws on the very run the `!initialized` check exists to
  // handle. It read as guarded and wasn't. Nothing caught it because no display
  // mounts before its view is measured — `LinearGenomeView` shows
  // `ViewLoadingScreen` for the whole of `showLoading`, which includes
  // `!initialized` — so the branch never ran. That is what made it latent, and
  // it is also why the fix is worth keeping rather than deleting the check: the
  // gate below is now the only thing standing between this body and a throw if
  // it is ever mounted somewhere that doesn't share the LGV's screen.
  if (!showBezierConnections || !view.initialized) {
    return null
  }
  const { width } = view

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
