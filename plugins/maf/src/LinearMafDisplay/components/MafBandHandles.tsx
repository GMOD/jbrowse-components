import { observer } from 'mobx-react'

import MafBandResizeHandle from './MafBandResizeHandle.tsx'

import type { LinearMafDisplayModel } from '../stateModel.ts'

/**
 * The resize handles straddling the bottom seam of each band over the rows,
 * one per band that reserves px. A drag starts from the drawn height, so a
 * band bound under its stated height moves with the pointer at once. The
 * bands' bars are the rendering backend's, and their axes the chrome's.
 */
const MafBandHandles = observer(function MafBandHandles({
  model,
}: {
  model: LinearMafDisplayModel
}) {
  const { coverage, conservation } = model.topBands.rects
  return (
    <>
      {coverage.height > 0 ? (
        <MafBandResizeHandle
          model={model}
          height={coverage.height}
          setHeight={h => {
            model.setCoverageHeight(h)
          }}
          seam={coverage.top + coverage.height}
        />
      ) : null}
      {conservation.height > 0 ? (
        <MafBandResizeHandle
          model={model}
          height={conservation.height}
          setHeight={h => {
            model.setConservationHeight(h)
          }}
          seam={conservation.top + conservation.height}
        />
      ) : null}
    </>
  )
})

export default MafBandHandles
