import { observer } from 'mobx-react'

import MafBandResizeHandle from './MafBandResizeHandle.tsx'

import type { LinearMafDisplayModel } from '../stateModel.ts'

/**
 * The coverage band's resize handle, straddling its bottom seam. Not its
 * pixels — those are drawn by the display's rendering backend, into the top of
 * the same canvas the rows are drawn into, so the band gets the GPU path
 * (render-core's shared coverage passes, the same ones the alignments pileup's
 * band draws) with Canvas2D as the fallback — and not its axis, which is the
 * chrome's off the display's `axes`.
 *
 * Which is why this is not a `MafBand` like the conservation band beside it: the
 * two differ now in where their marks come from, and `MafBand`'s whole job is
 * owning a `TrackBandCanvas`.
 */
const MafCoverageBand = observer(function MafCoverageBand({
  model,
  onResizeActiveChange,
}: {
  model: LinearMafDisplayModel
  onResizeActiveChange: (active: boolean) => void
}) {
  const { coverageBandActive, topBands } = model
  return (
    <>
      <MafBandResizeHandle
        model={model}
        show={coverageBandActive}
        resize={n => {
          model.resizeCoverageHeight(n)
        }}
        // straddles the band/rows seam
        top={topBands.top.coverage + topBands.reserved.coverage - 4}
        onActiveChange={onResizeActiveChange}
      />
    </>
  )
})

export default MafCoverageBand
