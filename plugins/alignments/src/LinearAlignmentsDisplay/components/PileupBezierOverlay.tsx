import { useState } from 'react'

import { observer } from 'mobx-react'

import {
  bezierArcKey,
  hiddenSegmentsNote,
} from '../../features/linkedReads/computeOverlay.ts'
import {
  BEZIER_ARC_STROKE_OPACITY,
  BEZIER_ARC_STROKE_WIDTH,
  computePileupBezierArcsFromModel,
} from './pileupBezierArcs.ts'
import { formatFeatureLabel } from './tooltipUtils.ts'

import type { PileupArc } from '../../features/linkedReads/computeOverlay.ts'
import type { LinearAlignmentsDisplayModel } from './useAlignmentsBase.ts'

// Takes the whole arc rather than positional (label, id1, id2) so the two ids
// can't be transposed at the call site.
function arcTooltip(
  model: LinearAlignmentsDisplayModel,
  arc: Pick<PileupArc, 'label' | 'id1' | 'id2' | 'hiddenSegmentsBetween'>,
) {
  const parts: string[] = []
  for (const id of [arc.id1, arc.id2]) {
    const info = model.getFeatureInfoById(id)
    if (info) {
      parts.push(formatFeatureLabel(info))
    }
  }
  const connection =
    parts.length > 0 ? `${arc.label}: ${parts.join(' → ')}` : arc.label
  // A second line, the way the breakpoint split view's `buildPairTooltip` adds
  // it: the dash says the junction is not direct and this says what it stepped
  // through, which is the only place those loci are named at all.
  return arc.hiddenSegmentsBetween?.length
    ? `${connection}<br/>${hiddenSegmentsNote(arc.hiddenSegmentsBetween)}`
    : connection
}

const PileupBezierOverlay = observer(function PileupBezierOverlay({
  model,
}: {
  model: LinearAlignmentsDisplayModel
}) {
  const [selectedArcId, setSelectedArcId] = useState<string | null>(null)
  const [hoveredArcId, setHoveredArcId] = useState<string | null>(null)
  const { view } = model
  const { bezierArcScope, height } = model

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
  if (bezierArcScope === 'none' || !view.initialized) {
    return null
  }
  const { width } = view

  const arcs = computePileupBezierArcsFromModel(model, view)

  if (!arcs.length) {
    return null
  }

  // Paint an emphasized (hovered/selected) curve last so a thin crossing curve
  // can't sit on top of it. The base order is otherwise preserved.
  //
  // The key is built once per arc rather than inside the comparator, which ran
  // it O(n log n) times over a list the map below then re-keys anyway.
  const keyed = arcs.map(arc => {
    const id = bezierArcKey(arc)
    return { arc, id, emphasis: id === hoveredArcId || id === selectedArcId }
  })
  const ordered = keyed.sort((a, b) => Number(a.emphasis) - Number(b.emphasis))

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
      {ordered.map(({ arc, id: arcId }) => {
        const isSelected = arcId === selectedArcId
        const isHovered = arcId === hoveredArcId
        const strokeWidth = isSelected
          ? 5
          : isHovered
            ? 3
            : BEZIER_ARC_STROKE_WIDTH
        return (
          <g key={arcId}>
            <path
              data-testid="pileup-bezier-arc"
              d={arc.d}
              stroke={arc.stroke}
              strokeWidth={strokeWidth}
              strokeOpacity={isHovered ? 1 : BEZIER_ARC_STROKE_OPACITY}
              strokeDasharray={arc.dash}
              fill="none"
              // Inert, with the target path below answering instead — the rule
              // `CrossRegionArcsOverlay` follows and for its reason:
              // `pointerEvents: 'stroke'` answers on the INK, so a dashed
              // connector would hover in its dashes and go dead in its gaps.
              // Same geometry and same width, so a solid arc's target is exactly
              // where its ink is.
              style={{ pointerEvents: 'none' }}
            />
            <path
              data-testid="pileup-bezier-arc-target"
              d={arc.d}
              stroke="transparent"
              strokeWidth={strokeWidth}
              fill="none"
              style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
              onMouseEnter={() => {
                setHoveredArcId(arcId)
                // Through `setHoverState`, as `CrossRegionArcsOverlay` is: it is
                // the one write the right-click menu's hover pin can refuse, so
                // a curve crossed while the menu is open cannot overwrite the
                // read the menu is acting on.
                model.setHoverState({
                  overCigarItem: false,
                  featureIdUnderMouse: undefined,
                  mouseoverExtraInformation: arcTooltip(model, arc),
                  highlightedChainReadIds: [],
                })
              }}
              onMouseLeave={() => {
                setHoveredArcId(prev => (prev === arcId ? null : prev))
                model.clearMouseoverState()
              }}
              onClick={() => {
                setSelectedArcId(isSelected ? null : arcId)
                void model.selectFeatureById(arc.id1)
                // The chain the curve belongs to, exactly as a canvas click on
                // one of its reads resolves it (`useAlignmentsBase`'s
                // handleClick) — otherwise clicking the connector selected one
                // end and left the rest of the chain unmarked.
                const hit = model.isChainMode
                  ? model.findFeatureInRpcData(arc.id1)
                  : undefined
                if (hit) {
                  model.setSelectedChainReadIds(
                    model.readIdsSharingChain(hit.rpcData, hit.idx),
                  )
                }
              }}
            />
          </g>
        )
      })}
    </svg>
  )
})

export default PileupBezierOverlay
