import { observer } from 'mobx-react'

import MafBandResizeHandle from './MafBandResizeHandle.tsx'
import MafYScaleGutter from './MafYScaleGutter.tsx'
import TrackBandCanvas from './TrackBandCanvas.tsx'

import type { LinearMafDisplayModel } from '../stateModel.ts'
import type { YScaleTicks } from '@jbrowse/wiggle-core'

/**
 * One stacked Canvas2D band above the per-sample rows: its canvas layer, its
 * Y-axis gutter, and the resize handle straddling its bottom seam. Everything
 * positional — the seam the handle sits on, the axis offset, the hidden-when-off
 * behavior — is decided once here rather than per band.
 *
 * The conservation band is the only one left: the coverage band moved onto the
 * display's rendering backend (render-core's shared coverage passes, GPU with
 * Canvas2D as the fallback) and so has no canvas of its own to own — see
 * `MafCoverageBand`, which is now the axis and the handle alone. What kept the
 * two together here was the positional geometry, and that is what
 * `rowsTopOffset` and the band's own `top` already state.
 *
 * `ticks` undefined means the band has no axis yet; the canvas still draws.
 */
const MafBand = observer(function MafBand({
  model,
  show,
  top,
  height,
  ticks,
  draw,
  resize,
  onResizeActiveChange,
}: {
  model: LinearMafDisplayModel
  show: boolean
  top: number
  height: number
  ticks: YScaleTicks | undefined
  draw: (ctx: CanvasRenderingContext2D) => void
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
      {show && ticks ? (
        <MafYScaleGutter top={top} height={height} ticks={ticks} />
      ) : null}
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
