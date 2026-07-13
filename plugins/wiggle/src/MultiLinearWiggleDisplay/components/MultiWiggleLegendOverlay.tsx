import { getContainingView } from '@jbrowse/core/util'
import { TrackOverlayPortal } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import OverlayColorLegend from '../../shared/OverlayColorLegend.tsx'
import { legendRightEdgePx } from '../../shared/wiggleComponentUtils.ts'

import type { MultiWiggleDisplayModel } from './multiWiggleDisplayTypes.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// The overlay-mode color legend. The display's own render tree is sealed in a
// `contain:strict` sandbox that the inter-region separator/elided masks paint
// over (they'd bury the legend at whole-genome scale), so TrackOverlayPortal
// lifts it above those masks. fallbackInline={false}: outside a TrackContainer
// it renders nothing, because the SVG-export path (renderSvg) draws its own
// inline legend where there are no masks to escape.
const MultiWiggleLegendOverlay = observer(function MultiWiggleLegendOverlay({
  model,
}: {
  model: MultiWiggleDisplayModel
}) {
  const view = getContainingView(model) as LinearGenomeViewModel
  const totalWidth = view.trackWidthPx
  const legendWidth = legendRightEdgePx(view.visibleRegions, totalWidth)
  return model.isOverlay && model.sources.length > 1 ? (
    <TrackOverlayPortal fallbackInline={false}>
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
        {/* svg spans the whole track (pointer-events:none so it doesn't eat
            canvas events); re-enable events only on the legend graphics so
            hovering the swatches doesn't fall through to wiggle tooltips */}
        <g style={{ pointerEvents: 'auto' }}>
          <OverlayColorLegend
            sources={model.sources}
            fallbackColor={model.posColor}
            canvasWidth={legendWidth}
          />
        </g>
      </svg>
    </TrackOverlayPortal>
  ) : null
})

export default MultiWiggleLegendOverlay
