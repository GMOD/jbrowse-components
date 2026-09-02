import { useState } from 'react'

import { ARC_HIT_SLOP_PX, hiddenSegmentsNote } from '@jbrowse/sv-core'
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

const SELECTED_STROKE_WIDTH = 5
const HOVERED_STROKE_WIDTH = 3

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

function nearerEndpoint(arc: PileupArc, x: number) {
  return Math.abs(x - arc.x1) <= Math.abs(x - arc.x2) ? arc.id1 : arc.id2
}

// The reads a hovered connector boxes: its chain in chain mode, else its two
// ends — what a canvas hover on one of those reads would box, so crossing from
// a read onto its connector does not drop the highlight.
function hoveredReadIds(model: LinearAlignmentsDisplayModel, arc: PileupArc) {
  const chain = model.readIdsSharingChainWith(arc.id1)
  return chain.length > 0 ? chain : [arc.id1, arc.id2]
}

const PileupBezierOverlay = observer(function PileupBezierOverlay({
  model,
}: {
  model: LinearAlignmentsDisplayModel
}) {
  const [hoveredReadName, setHoveredReadName] = useState<string | null>(null)
  const { view } = model
  const { bezierArcScope, height, selectedFeatureId } = model

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

  // Selection is the model's, not a local mirror of the last click: clearing
  // it on the canvas or selecting another read has to un-thicken the arc too.
  const selectedChain = new Set(model.selectedChainReadIds)
  const isSelected = (arc: PileupArc) =>
    arc.id1 === selectedFeatureId ||
    arc.id2 === selectedFeatureId ||
    selectedChain.has(arc.id1) ||
    selectedChain.has(arc.id2)

  // Emphasized curves are painted last so a thin crossing curve can't sit on
  // top of one. Every arc of the hovered read thickens, not only the one under
  // the cursor, the way the breakpoint split view thickens a whole chain.
  const plain: PileupArc[] = []
  const emphasized: PileupArc[] = []
  for (const arc of arcs) {
    const emphasis = arc.readName === hoveredReadName || isSelected(arc)
    ;(emphasis ? emphasized : plain).push(arc)
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
      {[...plain, ...emphasized].map(arc => {
        const arcId = bezierArcKey(arc)
        const isHovered = arc.readName === hoveredReadName
        const strokeWidth = isSelected(arc)
          ? SELECTED_STROKE_WIDTH
          : isHovered
            ? HOVERED_STROKE_WIDTH
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
              style={{ pointerEvents: 'none' }}
            />
            <path
              data-testid="pileup-bezier-arc-target"
              d={arc.d}
              stroke="transparent"
              strokeWidth={strokeWidth + 2 * ARC_HIT_SLOP_PX}
              fill="none"
              style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
              onMouseEnter={() => {
                setHoveredReadName(arc.readName)
                // Through `setHoverState`, as `CrossRegionArcsOverlay` is: it is
                // the one write the right-click menu's hover pin can refuse, so
                // a curve crossed while the menu is open cannot overwrite the
                // read the menu is acting on.
                model.setHoverState({
                  overCigarItem: false,
                  featureIdUnderMouse: undefined,
                  mouseoverExtraInformation: arcTooltip(model, arc),
                  highlightedChainReadIds: hoveredReadIds(model, arc),
                })
              }}
              onMouseLeave={() => {
                setHoveredReadName(prev =>
                  prev === arc.readName ? null : prev,
                )
                model.clearMouseoverState()
              }}
              onClick={e => {
                const svg = e.currentTarget.ownerSVGElement
                model.selectReadWithChain(
                  svg
                    ? nearerEndpoint(
                        arc,
                        e.clientX - svg.getBoundingClientRect().left,
                      )
                    : arc.id1,
                )
              }}
            />
          </g>
        )
      })}
    </svg>
  )
})

export default PileupBezierOverlay
