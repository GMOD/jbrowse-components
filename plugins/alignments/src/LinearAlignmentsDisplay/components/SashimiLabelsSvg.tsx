import { SASHIMI_SIDES } from '../../features/sashimi/bandFeed.ts'
import SashimiLabels from './SashimiLabels.tsx'
import { sashimiSideBand } from './sashimiArcs.ts'
import { bandScreenTop } from './sectionScreen.ts'

import type { LinearAlignmentsDisplayModel } from './useAlignmentsBase.ts'

// The junction read counts for SVG export, over the arcs the shared painter
// drew.
//
// Not an observer: this draws into a figure `useViewSvgFigure` freezes with a
// `memo`, which does not hold an observer still, and a subscription re-derived
// the band tops from the live scroll while the pileup stayed put.
export default function SashimiLabelsSvg({
  model,
}: {
  model: LinearAlignmentsDisplayModel
}) {
  const scroll = model.scrollModel
  return model.sashimiLabelSections.flatMap(section =>
    SASHIMI_SIDES.map(side => {
      const band = sashimiSideBand(section, side, model.bandHeights)
      return section[side].length === 0 ? null : (
        <g
          key={`${section.groupKey}-${side}`}
          transform={`translate(0,${bandScreenTop(band.top, scroll)})`}
        >
          <SashimiLabels labels={section[side]} />
        </g>
      )
    }),
  )
}
