import { use } from 'react'

import { getContainingView } from '@jbrowse/core/util'
import { TrackOverlayContext } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'
import { createPortal } from 'react-dom'

import OverlayColorLegend from '../../shared/OverlayColorLegend.tsx'
import { legendRightEdgePx } from '../../shared/wiggleComponentUtils.ts'

import type { MultiWiggleDisplayModel } from './multiWiggleDisplayTypes.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// The overlay-mode color legend. The display's own render tree is sealed in a
// `contain:strict` sandbox that the inter-region separator/elided masks paint
// over (they'd bury the legend at whole-genome scale), so this portals the
// legend into the TrackContainer's above-the-masks overlay node
// (TrackOverlayContext). No portal target (display outside a TrackContainer, or
// non-overlay / single-source) → renders nothing. The SVG-export path draws its
// own inline legend (renderSvg), where there are no masks to escape.
const MultiWiggleLegendOverlay = observer(function MultiWiggleLegendOverlay({
  model,
}: {
  model: MultiWiggleDisplayModel
}) {
  const overlayEl = use(TrackOverlayContext)
  const view = getContainingView(model) as LinearGenomeViewModel
  const totalWidth = view.trackWidthPx
  const legendWidth = legendRightEdgePx(view.visibleRegions, totalWidth)
  return overlayEl && model.isOverlay && model.sources.length > 1
    ? createPortal(
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: totalWidth,
            height: model.height,
            pointerEvents: 'none',
            overflow: 'hidden',
          }}
        >
          <OverlayColorLegend
            sources={model.sources}
            fallbackColor={model.posColor}
            canvasWidth={legendWidth}
          />
        </svg>,
        overlayEl,
      )
    : null
})

export default MultiWiggleLegendOverlay
