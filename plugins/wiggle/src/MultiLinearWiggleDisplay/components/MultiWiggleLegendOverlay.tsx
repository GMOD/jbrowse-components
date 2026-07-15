import { getContainingView } from '@jbrowse/core/util'
import { FloatingSvgOverlay } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import OverlayColorLegend from '../../shared/OverlayColorLegend.tsx'
import { legendRightEdgePx } from '../../shared/wiggleComponentUtils.ts'

import type { MultiWiggleDisplayModel } from './multiWiggleDisplayTypes.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// The overlay-mode color legend, lifted above the inter-region masks by
// FloatingSvgOverlay (the display's inline tree is painted over by them at
// whole-genome scale). The inner <g> re-enables pointer events so hovering the
// swatches doesn't fall through to wiggle tooltips.
const MultiWiggleLegendOverlay = observer(function MultiWiggleLegendOverlay({
  model,
}: {
  model: MultiWiggleDisplayModel
}) {
  const view = getContainingView(model) as LinearGenomeViewModel
  const totalWidth = view.trackWidthPx
  const legendWidth = legendRightEdgePx(view.visibleRegions, totalWidth)
  return model.isOverlay && model.sources.length > 1 && model.showLegend ? (
    <FloatingSvgOverlay width={totalWidth} height={model.height}>
      <g style={{ pointerEvents: 'auto' }}>
        <OverlayColorLegend
          sources={model.sources}
          fallbackColor={model.posColor}
          canvasWidth={legendWidth}
          maxHeight={model.height}
          onDismiss={() => {
            model.setShowLegend(false)
          }}
        />
      </g>
    </FloatingSvgOverlay>
  ) : null
})

export default MultiWiggleLegendOverlay
