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
      {coverageBandActive ? (
        <MafBandResizeHandle
          model={model}
          resize={n => {
            model.resizeCoverageHeight(n)
          }}
          seam={topBands.top.coverage + topBands.reserved.coverage}
          onActiveChange={onResizeActiveChange}
        />
      ) : null}
      {conservationBandActive ? (
        <MafBandResizeHandle
          model={model}
          resize={n => {
            model.resizeConservationHeight(n)
          }}
          seam={topBands.top.conservation + topBands.reserved.conservation}
          onActiveChange={onResizeActiveChange}
        />
      ) : null}
    </>
  )
})

export default MafBandHandles
