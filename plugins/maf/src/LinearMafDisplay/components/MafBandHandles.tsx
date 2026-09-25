import { observer } from 'mobx-react'

import MafBandResizeHandle from './MafBandResizeHandle.tsx'

import type { LinearMafDisplayModel } from '../stateModel.ts'

/**
 * The resize handles straddling the bottom seam of each band over the rows.
 * The bands' bars are the rendering backend's, and their axes the chrome's.
 */
const MafBandHandles = observer(function MafBandHandles({
  model,
  onResizeActiveChange,
}: {
  model: LinearMafDisplayModel
  onResizeActiveChange: (active: boolean) => void
}) {
  const { topBands, coverageBandActive, conservationBandActive } = model
  return (
    <>
      <MafBandResizeHandle
        model={model}
        show={coverageBandActive}
        resize={n => {
          model.resizeCoverageHeight(n)
        }}
        top={topBands.top.coverage + topBands.reserved.coverage - 4}
        onActiveChange={onResizeActiveChange}
      />
      <MafBandResizeHandle
        model={model}
        show={conservationBandActive}
        resize={n => {
          model.resizeConservationHeight(n)
        }}
        top={topBands.top.conservation + topBands.reserved.conservation - 4}
        onActiveChange={onResizeActiveChange}
      />
    </>
  )
})

export default MafBandHandles
