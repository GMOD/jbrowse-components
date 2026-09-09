import { observer } from 'mobx-react'

import MafBandResizeHandle from './MafBandResizeHandle.tsx'
import TrackBandCanvas from './TrackBandCanvas.tsx'

import type { LinearMafDisplayModel } from '../stateModel.ts'
import type { BandDraw } from './TrackBandCanvas.tsx'

/**
 * One stacked Canvas2D band above the per-sample rows: its canvas layer and
 * the resize handle straddling its bottom seam. The band's axis is the
 * chrome's, off the display's `axes`.
 *
 * The conservation band is the only one left: the coverage band moved onto the
 * display's rendering backend (render-core's shared coverage passes, GPU with
 * Canvas2D as the fallback) and so has no canvas of its own to own — see
 * `MafCoverageBand`, which is now the handle alone.
 */
const MafBand = observer(function MafBand({
  model,
  show,
  top,
  height,
  draw,
  resize,
  onResizeActiveChange,
}: {
  model: LinearMafDisplayModel
  show: boolean
  top: number
  height: number
  draw: BandDraw
  resize: (distance: number) => void
  onResizeActiveChange: (active: boolean) => void
}) {
  return (
    <>
      <TrackBandCanvas
        model={model}
        top={top}
        height={height}
        show={show}
        draw={draw}
      />
      <MafBandResizeHandle
        model={model}
        show={show}
        resize={resize}
        // straddles the band/rows seam
        top={top + height - 4}
        onActiveChange={onResizeActiveChange}
      />
    </>
  )
})

export default MafBand
