import { getContainingView } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { arcColorLegendCategory } from '../../features/arcs/arcColors.ts'
import { arcMarkScreenPath } from '../../features/arcs/arcPath.ts'
import { offsetArcMark } from '../../features/arcs/mark.ts'
import CrossRegionArcMarkers from './CrossRegionArcMarkers.tsx'
import { bandOnScreen, bandScreenTop } from './sectionScreen.ts'
import { formatArcTooltip } from './tooltipUtils.ts'

import type { CrossRegionArcShape } from '../../features/arcs/crossRegionOverlay.ts'
import type { LinearAlignmentsDisplayModel } from './useAlignmentsBase.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// One section's cross-region arcs as an absolutely-positioned SVG at the
// (scrolled) arc-band top.
//
// These are the arcs the GPU and Canvas2D passes cannot draw: each maps bp to x
// through the block it is drawing, so an arc with a foot in another displayed
// region has that foot extrapolated to a place the other block is not. They used
// to be handed to both blocks and come out as two dangling halves; now they are
// held out of the per-region buffers entirely (`resolveArcs`) and drawn here,
// where each foot resolves through its own region.
//
// SVG rather than a canvas pass, for sashimi's reasons: the set is small (a
// fragment can straddle only one seam — 52 of 381 arcs in the two-region view
// this was measured on, none at all in a single-region one), and per-path
// handlers give the hover for free. The canvas hit test never sees these arcs,
// which is correct rather than a gap: `hitTestArcBand` walks `ArcsUploadData`,
// and they are deliberately not in it.
//
// Being a separate z-layer, a cross-region arc paints above every canvas arc and
// tick regardless of `arcPaintRank` — which is a limit of the layering rather
// than a claim about the arcs. At depth most of this set is ordinary concordant
// pairs straddling the seam (see `CROSS_REGION_ARC_CAP`), so WITHIN the layer
// the rank decides, off the same `arcPaintOrder` the canvas feed uses.
const CrossRegionArcsBand = observer(function CrossRegionArcsBand({
  model,
  arcs,
  screenTop,
  height,
  width,
}: {
  model: LinearAlignmentsDisplayModel
  arcs: CrossRegionArcShape[]
  screenTop: number
  height: number
  width: number
}) {
  return (
    <svg
      data-testid="cross-region-arcs-overlay"
      style={{
        position: 'absolute',
        top: screenTop,
        left: 0,
        pointerEvents: 'none',
        height,
        width,
        // Clipped to the band it was reserved, the same rect both renderers
        // scissor their arc passes to. Without it a tall dome would paint over
        // the coverage histogram or the pileup stacked next to the band.
        overflow: 'hidden',
      }}
    >
      {arcs.map(arc => (
        <g key={arc.key}>
          <path
            data-testid="cross-region-arc"
            d={arc.d}
            stroke={arc.stroke}
            strokeWidth={arc.strokeWidth}
            strokeDasharray={arc.dash}
            fill="none"
            // Inert, so the hover is decided entirely by the target path below
            // rather than by whichever of the two the pointer happened to land
            // on. A dashed split connector would otherwise answer on its dashes
            // and not in its gaps.
            style={{ pointerEvents: 'none' }}
          />
          <path
            data-testid="cross-region-arc-target"
            d={arc.d}
            stroke="transparent"
            // The canvas band's tolerance, spelled for a renderer that has no
            // hit test — see `hitStrokeWidth`. Undashed on purpose, per above.
            strokeWidth={arc.hitStrokeWidth}
            fill="none"
            style={{ pointerEvents: 'stroke', cursor: 'default' }}
            onMouseEnter={() => {
              // `setHoverState`, not a local hovered-key that thickens this
              // path's own stroke. `ArcHoverOverlay` is its own z-layer and
              // draws the highlight for a canvas arc, so a second mechanism
              // here can show two hovers in one band at once; routing through
              // the same state makes a seam-crossing arc hover exactly like any
              // other.
              model.setHoverState({
                // FALSE, as for a canvas arc: `overCigarItem` is the pointer
                // cursor, and an arc carries no read id to select or open.
                overCigarItem: false,
                featureIdUnderMouse: undefined,
                mouseoverExtraInformation: formatArcTooltip(
                  {
                    x1: arc.start,
                    x2: arc.end,
                    support: arc.support,
                    shapeType: arc.shapeType,
                    spanBp: arc.spanBp,
                  },
                  arc.refName,
                  arcColorLegendCategory(arc.colorType, model.arcColorByType),
                  arc.endRefName,
                ),
                hoveredArcHighlight: {
                  // The band-local mark, moved to the component's origin, which
                  // is where `ArcHoverOverlay` draws. Same mark, so the
                  // highlight lies on the arc rather than near it.
                  d: arcMarkScreenPath(offsetArcMark(arc.mark, screenTop)),
                  // This overlay's own box, which IS its clip (`overflow:
                  // hidden`) — the highlight has to be cut at the same rect or
                  // a far pair's dome traces across the coverage histogram.
                  clip: { x: 0, y: screenTop, width, height },
                  // The DRAWN width, not the target's: the highlight is meant to
                  // read as this arc lighting up, and the target is deliberately
                  // wider than the ink.
                  lineWidth: arc.strokeWidth,
                },
                highlightedChainReadIds: [],
              })
            }}
            onMouseLeave={() => {
              model.clearMouseoverState()
            }}
          />
        </g>
      ))}
      <CrossRegionArcMarkers arcs={arcs} />
    </svg>
  )
})

// Every section's cross-region arcs. Empty in a single-region view, which is
// what keeps this free on the path almost every session takes.
const CrossRegionArcsOverlay = observer(function CrossRegionArcsOverlay({
  model,
}: {
  model: LinearAlignmentsDisplayModel
}) {
  const { scrollModel: scroll, crossRegionArcSections: sections } = model
  if (sections.length === 0) {
    return null
  }
  // Read AFTER that gate: `view.width` throws by design before the view is
  // measured, and `crossRegionArcSections` is empty until `view.initialized`.
  const { width } = getContainingView(model) as LinearGenomeViewModel
  return sections.map(section => {
    const screenTop = bandScreenTop(section.bandTop, scroll)
    // A grouped display re-renders on every scroll frame, so an off-screen
    // lane's paths would be reconciled once per frame for a band nobody can
    // see — the same cull `SashimiArcsOverlay` and `GroupLabelsOverlay` apply.
    return bandOnScreen(screenTop, section.bandHeight, scroll) ? (
      <CrossRegionArcsBand
        key={section.groupKey}
        model={model}
        arcs={section.arcs}
        screenTop={screenTop}
        height={section.bandHeight}
        width={width}
      />
    ) : null
  })
})

export default CrossRegionArcsOverlay
