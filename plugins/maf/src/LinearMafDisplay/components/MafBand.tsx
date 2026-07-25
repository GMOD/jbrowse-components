import React from 'react'

import { observer } from 'mobx-react'

import MafBandResizeHandle from './MafBandResizeHandle.tsx'
import MafYScaleGutter from './MafYScaleGutter.tsx'
import TrackBandCanvas from './TrackBandCanvas.tsx'

import type { LinearMafDisplayModel } from '../stateModel.ts'
import type { YScaleTicks } from '@jbrowse/wiggle-core'

/**
 * One stacked band above the per-sample rows: its Canvas2D layer, its Y-axis
 * gutter, and the resize handle straddling its bottom seam. The coverage and
 * conservation bands differ only in what they draw and what their axis reads,
 * so everything positional — the seam the handle sits on, the axis offset, the
 * hidden-when-off behavior — is decided once here rather than re-derived per
 * band (where the two had already drifted to spelling the same seam two
 * different ways).
 *
 * `ticks` undefined means the band has no axis yet (coverage before its domain
 * resolves); the canvas still draws.
 */
const MafBand = observer(function MafBand({
  model,
  show,
  top,
  height,
  ticks,
  draw,
  setHeight,
  onResizeActiveChange,
}: {
  model: LinearMafDisplayModel
  show: boolean
  top: number
  height: number
  ticks: YScaleTicks | undefined
  draw: (ctx: CanvasRenderingContext2D) => void
  setHeight: (n: number) => void
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
        height={height}
        setHeight={setHeight}
        // straddles the band/rows seam
        top={top + height - 4}
        onActiveChange={onResizeActiveChange}
      />
    </>
  )
})

export default MafBand
