import { observer } from 'mobx-react'

import { SASHIMI_SIDES } from '../../features/sashimi/bandFeed.ts'
import SashimiLabels from './SashimiLabels.tsx'
import { sashimiSideBand } from './sashimiArcs.ts'
import { bandOnScreen, bandScreenTop } from './sectionScreen.ts'

import type { LinearAlignmentsDisplayModel } from './useAlignmentsBase.ts'

// The junction read counts over the canvas the arcs draw on: one SVG per side
// per section at its band's screen top. The canvas underneath answers the
// hover and the click.
const SashimiLabelsOverlay = observer(function SashimiLabelsOverlay({
  model,
}: {
  model: LinearAlignmentsDisplayModel
}) {
  const { scrollModel: scroll, sashimiLabelSections: sections } = model
  if (sections.length === 0) {
    return null
  }
  // after the gate: `view.width` throws before the view is measured, and the
  // sections are empty until then
  const { width } = model.view
  return sections.flatMap(section =>
    SASHIMI_SIDES.map(side => {
      const labels = section[side]
      const band = sashimiSideBand(section, side, model.bandHeights)
      const screenTop = bandScreenTop(band.top, scroll)
      // A grouped display re-renders on every scroll frame, so an off-screen
      // lane's labels would be reconciled for a band nobody can see.
      return labels.length === 0 ||
        !bandOnScreen(screenTop, band.height, scroll) ? null : (
        <svg
          key={`${section.groupKey}-${side}`}
          style={{
            position: 'absolute',
            top: screenTop,
            left: 0,
            pointerEvents: 'none',
            height: band.height,
            width,
            overflow: 'visible',
          }}
        >
          <SashimiLabels labels={labels} />
        </svg>
      )
    }),
  )
})

export default SashimiLabelsOverlay
