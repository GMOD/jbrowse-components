import { observer } from 'mobx-react'

import MafBandResizeHandle from './MafBandResizeHandle.tsx'

import type { LinearMafDisplayModel } from '../stateModel.ts'

/**
 * The resize handles straddling the bottom seam of each band over the rows.
 * The bands' bars are the rendering backend's, and their axes the chrome's.
 */
const MafBandHandles = observer(function MafBandHandles({
  model,
}: {
  model: LinearMafDisplayModel
}) {
  const { topBands, coverageBandActive, conservationBandActive } = model
  return (
    <>
      {coverageBandActive ? (
        <MafBandResizeHandle
          model={model}
          height={model.coverageHeight}
          setHeight={h => {
            model.setCoverageHeight(h)
          }}
          seam={topBands.top.coverage + topBands.reserved.coverage}
        />
      ) : null}
      {conservationBandActive ? (
        <MafBandResizeHandle
          model={model}
          height={model.conservationHeight}
          setHeight={h => {
            model.setConservationHeight(h)
          }}
          seam={topBands.top.conservation + topBands.reserved.conservation}
        />
      ) : null}
    </>
  )
})

export default MafBandHandles
