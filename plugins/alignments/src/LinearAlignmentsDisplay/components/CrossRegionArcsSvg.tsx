import { SvgClipRect } from '@jbrowse/core/svg/SvgExport'
import { svgNodeId } from '@jbrowse/core/svg/svgId'

import CrossRegionArcMarkers from './CrossRegionArcMarkers.tsx'
import { bandScreenTop } from './sectionScreen.ts'

import type { LinearAlignmentsDisplayModel } from './useAlignmentsBase.ts'

// The export twin of `CrossRegionArcsOverlay`, off the very same
// `crossRegionArcSections` geometry, minus the hover handlers.
//
// It has to exist separately from `drawAlignmentBlocks`, which is what the rest
// of the arc band exports through: that walks BLOCKS, and these are precisely
// the arcs no block can draw. Clipped to the band rect, the same box the live
// overlay applies as `overflow: hidden` and the same one both renderers scissor
// their arc passes to — an export that drew them unclipped would show a figure
// the screen never did.
// Not an observer, for the reason `SashimiArcsSvg` states: this draws into a
// figure `useViewSvgFigure` freezes with a `memo`, and a `memo` does not hold
// an observer still. Subscribing here re-derived `bandScreenTop` from the live
// scroll, and `crossRegionArcSections` from the live pan, while the pileup
// underneath stayed where the snapshot left it.
export default function CrossRegionArcsSvg({
  model,
  width,
}: {
  model: LinearAlignmentsDisplayModel
  width: number
}) {
  const scroll = model.scrollModel
  const nodeId = svgNodeId(model)
  return model.crossRegionArcSections.map(section => (
    <g
      key={section.groupKey}
      transform={`translate(0,${bandScreenTop(section.bandTop, scroll)})`}
    >
      <SvgClipRect
        id={`cross-region-arcs-${section.groupKey}-${nodeId}`}
        width={width}
        height={section.bandHeight}
      >
        {section.arcs.map(arc => (
          <path
            key={arc.key}
            d={arc.d}
            stroke={arc.stroke}
            strokeWidth={arc.strokeWidth}
            strokeDasharray={arc.dash}
            fill="none"
          />
        ))}
        <CrossRegionArcMarkers arcs={section.arcs} />
      </SvgClipRect>
    </g>
  ))
}
