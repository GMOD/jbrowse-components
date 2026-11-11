import { getContainingTrack } from '@jbrowse/core/util'
import { BandSeamHandle } from '@jbrowse/display-kit/BandSeamHandle'
import { observer } from 'mobx-react'

import { MAF_BAND_ORDER } from '../mafTopBands.ts'

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
 *
 * A band eats into the rows area, so a drag restretches every row each frame;
 * the drag sets the track's own resizing flag, which suppresses the dense
 * letter overlay as the track-height handle does.
 */
const MafBandHandles = observer(function MafBandHandles({
  model,
}: {
  model: LinearMafDisplayModel
}) {
  const { rects } = model.topBands
  const track = getContainingTrack(model)
  return (
    <>
      {MAF_BAND_ORDER.map(key => {
        const { top, height } = rects[key]
        return height > 0 ? (
          <BandSeamHandle
            key={key}
            seam={top + height}
            title={`Drag to resize the ${key} band`}
            value={height}
            onChange={h => {
              SET_BAND_HEIGHT[key](model, h)
            }}
            onDragStart={() => {
              track.setResizing(true)
            }}
            onDragEnd={() => {
              track.setResizing(false)
            }}
          />
        ) : null
      })}
    </>
  )
})

export default MafBandHandles
