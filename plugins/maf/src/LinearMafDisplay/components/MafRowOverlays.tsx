import { useMemo } from 'react'

import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import OverlayCanvas from '@jbrowse/render-core/OverlayCanvas'
import { observer } from 'mobx-react'

import { mafInsertionParams } from '../../LinearMafRenderer/mafMarks.ts'
import {
  getMafOverlayTheme,
  paintMafRowOverlays,
} from '../../LinearMafRenderer/rendering/rowOverlays.ts'

import type { MafRowOverlays as Overlays } from '../../LinearMafRenderer/rendering/rowOverlays.ts'
import type { LinearMafDisplayModel } from '../stateModel.ts'

/**
 * The rows' Canvas2D overlays on one canvas over the rows canvas, positioned
 * in the rows container so the band's origin is its top. The model's arrays
 * are read here, in render, since `OverlayCanvas` draws in an effect that
 * tracks nothing.
 */
const MafRowOverlays = observer(function MafRowOverlays({
  model,
  width,
  height,
}: {
  model: LinearMafDisplayModel
  width: number
  height: number
}) {
  const palette = usePalette()
  const theme = useMemo(() => getMafOverlayTheme(palette), [palette])
  const { encodedUpload, renderState } = model
  const overlays: Overlays = {
    emptyLines: model.visibleEmptyLines,
    frames: model.visibleFrames,
    insertions: {
      blocks: model.renderBlocks,
      channelsOf: block =>
        encodedUpload.get(block.displayedRegionIndex)?.insertions,
      frame: { canvasWidth: width, canvasHeight: height },
      params: mafInsertionParams({ ...renderState, rowsTop: 0 }),
    },
    deletions: model.visibleDeletions,
    labels: model.visibleLabels,
    codonGlyphs: model.visibleCodonGlyphs,
    inversions: model.visibleInversions,
  }
  return (
    <OverlayCanvas
      width={width}
      height={height}
      draw={ctx => {
        paintMafRowOverlays(ctx, overlays, theme)
      }}
    />
  )
})

export default MafRowOverlays
