import { observer } from 'mobx-react'

import MafBandResizeHandle from './MafBandResizeHandle.tsx'
import MafYScaleGutter from './MafYScaleGutter.tsx'

import type { LinearMafDisplayModel } from '../stateModel.ts'

/**
 * The coverage band's chrome: its Y-axis gutter and the resize handle straddling
 * its bottom seam. Not its pixels — those are drawn by the display's rendering
 * backend, into the top of the same canvas the rows are drawn into, so the band
 * gets the GPU path (render-core's shared coverage passes, the same ones the
 * alignments pileup's band draws) with Canvas2D as the fallback.
 *
 * Which is why this is not a `MafBand` like the conservation band beside it: the
 * two differ now in where their marks come from, and `MafBand`'s whole job is
 * owning a `TrackBandCanvas`. `ticks` absent means the domain has not resolved
 * yet, and then there is nothing in the band to label either.
 */
const MafCoverageBand = observer(function MafCoverageBand({
  model,
  onResizeActiveChange,
}: {
  model: LinearMafDisplayModel
  onResizeActiveChange: (active: boolean) => void
}) {
  const { coverageBandActive, coverageHeight, coverageTicks } = model
  return (
    <>
      {coverageBandActive && coverageTicks ? (
        <MafYScaleGutter
          top={0}
          height={coverageHeight}
          ticks={coverageTicks}
        />
      ) : null}
      <MafBandResizeHandle
        model={model}
        show={coverageBandActive}
        resize={n => {
          model.resizeCoverageHeight(n)
        }}
        // straddles the band/rows seam
        top={coverageHeight - 4}
        onActiveChange={onResizeActiveChange}
      />
    </>
  )
})

export default MafCoverageBand
