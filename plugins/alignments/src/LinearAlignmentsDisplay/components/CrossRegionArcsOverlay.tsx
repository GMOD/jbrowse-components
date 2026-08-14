import { useState } from 'react'

import { getContainingView } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { arcColorLegendCategory } from '../../features/arcs/compute.ts'
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
// held out of the per-region buffers entirely (`resolveArcsForRender`) and drawn
// here, where each foot resolves through its own region.
//
// SVG rather than a canvas pass, for sashimi's reasons: the set is small (a
// fragment can straddle only one seam — 52 of 381 arcs in the two-region view
// this was measured on, none at all in a single-region one), and per-path
// handlers give the hover for free. The canvas hit test never sees these arcs,
// which is correct rather than a gap: `hitTestArcBand` walks `ArcsUploadData`,
// and they are deliberately not in it.
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
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)
  return (
    <svg
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
        <path
          key={arc.key}
          d={arc.d}
          stroke={arc.stroke}
          strokeWidth={
            arc.key === hoveredKey ? arc.strokeWidth + 2 : arc.strokeWidth
          }
          fill="none"
          style={{ pointerEvents: 'stroke', cursor: 'default' }}
          onMouseEnter={() => {
            setHoveredKey(arc.key)
            model.setMouseoverExtraInformation(
              // The same payload the canvas hit test builds for a within-region
              // arc, so an arc that happens to cross a seam reads identically to
              // one that does not — `formatArcTooltip` orders the endpoints and
              // names the colour's category.
              formatArcTooltip(
                {
                  x1: arc.start,
                  x2: arc.end,
                  support: arc.support,
                  shapeType: arc.shapeType,
                  spanBp: arc.spanBp,
                },
                arc.refName,
                arcColorLegendCategory(arc.colorType, model.arcColorByType),
              ),
            )
          }}
          onMouseLeave={() => {
            setHoveredKey(null)
            model.clearMouseoverState()
          }}
        />
      ))}
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
