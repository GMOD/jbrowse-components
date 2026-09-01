import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import OverlayCanvas from '@jbrowse/render-core/OverlayCanvas'
import { observer } from 'mobx-react'

import { drawDensityBand } from './densityBand.ts'

import type { DensityBandLayer } from './densityBand.ts'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

export interface DensityBandDisplay {
  densityBandActive: boolean
  densityBandLayer: DensityBandLayer
  densityReadout: string
  renderBlocks: RenderBlock[]
  canvasWidthPx: number
  height: number
  markCanvasDrawn: () => void
}

/**
 * The features-per-bin band, composited over whichever backend drew the
 * (empty) feature canvas. Its own observer, and the geometry reads live in
 * `DensityBandCanvas` below rather than here, because `canvasWidthPx` and
 * `renderBlocks` both reach view geometry that throws before the view is
 * measured — `densityBandActive` is what says it has been.
 */
const DensityBandOverlay = observer(function DensityBandOverlay({
  model,
}: {
  model: DensityBandDisplay
}) {
  return model.densityBandActive ? <DensityBandCanvas model={model} /> : null
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
          color: palette.text.secondary,
          readout: densityReadout,
          backing: palette.background.paper,
        })
        // the feature canvas under this one draws nothing while the tier is
        // active, so the band is the display's first paint
        model.markCanvasDrawn()
      }}
    />
  )
})

export default DensityBandOverlay
