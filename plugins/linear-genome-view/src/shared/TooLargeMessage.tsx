import { isAlive } from '@jbrowse/mobx-state-tree'
import { Button } from '@mui/material'
import { observer } from 'mobx-react'

import BlockMsg from './BlockMsg.tsx'
import { tooLargeBannerText } from './regionTooLargeUtils.ts'

export interface TooLargeMessageModel {
  regionTooLargeReason: string
  // Optional because the displays outside `RegionTooLargeMixin` (wiggle,
  // manhattan) duck-type this interface and have no such getter. Absent means
  // "zooming still helps", which is right for them: nothing they own opts out of
  // the AUTO_FORCE_LOAD_BP floor, so the floor still guarantees a release.
  zoomCanReleaseGate?: boolean
  forceLoad: () => void
}

const TooLargeMessage = observer(function TooLargeMessage({
  model,
}: {
  model: TooLargeMessageModel
}) {
  const { regionTooLargeReason, zoomCanReleaseGate } = model
  return (
    <BlockMsg
      severity="warning"
      action={
        <Button
          onClick={() => {
            if (isAlive(model)) {
              model.forceLoad()
            }
          }}
        >
          Force load
        </Button>
      }
      message={tooLargeBannerText(regionTooLargeReason, {
        zoomCanRelease: zoomCanReleaseGate,
      })}
    />
  )
})

export default TooLargeMessage
