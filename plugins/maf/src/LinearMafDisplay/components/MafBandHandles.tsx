import { observer } from 'mobx-react'

import { MAF_BAND_ORDER } from '../mafTopBands.ts'
import MafBandResizeHandle from './MafBandResizeHandle.tsx'

import type { MafBandKey } from '../mafTopBands.ts'
import type { LinearMafDisplayModel } from '../stateModel.ts'

const SET_BAND_HEIGHT: Record<
  MafBandKey,
  (model: LinearMafDisplayModel, height: number) => void
> = {
  coverage: (model, height) => {
    model.setCoverageHeight(height)
  },
  conservation: (model, height) => {
    model.setConservationHeight(height)
  },
}

/**
 * The resize handles straddling the bottom seam of each band over the rows,
 * one per band that reserves px, in the stack's own order. The bands' bars are
 * the rendering backend's, and their axes the chrome's.
 */
const MafBandHandles = observer(function MafBandHandles({
  model,
}: {
  model: LinearMafDisplayModel
}) {
  const { rects } = model.topBands
  return (
    <>
      {MAF_BAND_ORDER.map(key => {
        const { top, height } = rects[key]
        return height > 0 ? (
          <MafBandResizeHandle
            key={key}
            model={model}
            height={height}
            setHeight={h => {
              SET_BAND_HEIGHT[key](model, h)
            }}
            seam={top + height}
            title={`Drag to resize the ${key} band`}
          />
        ) : null
      })}
    </>
  )
})

export default MafBandHandles
