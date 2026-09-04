import { observer } from 'mobx-react'

import MafBand from './MafBand.tsx'
import {
  conservationTicks,
  drawCodonConservation,
  drawConservation,
} from './drawConservation.ts'

import type { LinearMafDisplayModel } from '../stateModel.ts'
import type { Theme } from '@mui/material'

/**
 * Percent-identity conservation band, stacked directly below the coverage band.
 * Unlike coverage its axis is a fixed 0–100% scale, so it always has ticks. The
 * `codon` mode swaps per-base identity for per-codon amino-acid identity; both
 * share the band geometry and palette.
 *
 * The swap is keyed on `codonConservationActive`, not on `conservationMode`
 * alone: codons need frames to define them and per-base blocks to translate, so
 * the mode selects the codon band only where those exist. Reading the raw mode
 * left the band permanently blank on a track configured `conservationMode:
 * 'codon'` with no `annotationAdapter` — `visibleCodonConservation` is gated on
 * the same getter and returns nothing there.
 *
 * Shown on `conservationBandActive`, not the raw `showConservation`, for the
 * same class of reason one level up: identity is computed from the alignment,
 * which the summary path clears.
 */
// Module level, and reading the band's geometry off the model rather than off
// the render — see `BandDraw`.
function drawBand(
  ctx: CanvasRenderingContext2D,
  model: LinearMafDisplayModel,
  theme: Theme,
) {
  const state = {
    conservationHeight: model.conservationDisplayHeight,
    canvasWidth: model.canvasWidthPx,
    theme,
  }
  if (model.codonConservationActive) {
    drawCodonConservation(ctx, model.visibleCodonConservation, state)
  } else {
    drawConservation(ctx, model.renderBlocks, model.rpcDataMap, state)
  }
}

const MafConservationBand = observer(function MafConservationBand({
  model,
  onResizeActiveChange,
}: {
  model: LinearMafDisplayModel
  onResizeActiveChange: (active: boolean) => void
}) {
  const { conservationBandActive, conservationDisplayHeight, topBands } = model
  return (
    <MafBand
      model={model}
      show={conservationBandActive}
      top={topBands.top.conservation}
      height={conservationDisplayHeight}
      ticks={conservationTicks(conservationDisplayHeight)}
      resize={n => {
        model.resizeConservationHeight(n)
      }}
      onResizeActiveChange={onResizeActiveChange}
      draw={drawBand}
    />
  )
})

export default MafConservationBand
