import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import OverlayCanvas from '@jbrowse/render-core/OverlayCanvas'
import { observer } from 'mobx-react'

import { drawDensityBand } from './densityBand.ts'

import type { DensityBandLayer } from './densityBand.ts'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

export interface DensityBandDisplay {
  coarseTierStandsIn: boolean
  densityBandLayer: DensityBandLayer
  densityReadout: string
  renderBlocks: RenderBlock[]
  canvasWidthPx: number
  height: number
  markCanvasDrawn: () => void
}

/**
 * The geometry reads live in `DensityBandCanvas` rather than here, because
 * `canvasWidthPx` and `renderBlocks` reach view geometry that throws before the
 * view is measured, and `coarseTierStandsIn` is what says it has been.
 */
const DensityBandOverlay = observer(function DensityBandOverlay({
  model,
}: {
  model: DensityBandDisplay
}) {
  return model.coarseTierStandsIn ? <DensityBandCanvas model={model} /> : null
})

const DensityBandCanvas = observer(function DensityBandCanvas({
  model,
}: {
  model: DensityBandDisplay
}) {
  const palette = usePalette()
  const {
    densityBandLayer,
    densityReadout,
    renderBlocks,
    canvasWidthPx,
    height,
  } = model
  return (
    <OverlayCanvas
      width={canvasWidthPx}
      height={height}
      data-testid="density-band"
      draw={ctx => {
        drawDensityBand(ctx, renderBlocks, densityBandLayer, {
          canvasWidth: canvasWidthPx,
          bandHeight: height,
          readout: densityReadout,
          palette,
        })
        // the feature canvas under this one draws nothing while the tier is
        // active, so the band is the display's first paint
        model.markCanvasDrawn()
      }}
    />
  )
})

export default DensityBandOverlay
