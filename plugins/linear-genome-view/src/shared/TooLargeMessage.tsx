import { isAlive } from '@jbrowse/mobx-state-tree'
import { Button } from '@mui/material'
import { observer } from 'mobx-react'

import BlockMsg from './BlockMsg.tsx'
import { tooLargeBannerText } from './regionTooLargeUtils.ts'

export interface TooLargeMessageModel {
  regionTooLargeReason: string
  // Optional because the displays outside `RegionTooLargeMixin` (wiggle,
  // manhattan) duck-type this interface and have no such getter. Absent means
  // "zooming still helps", which is right for them: they gate on their own
  // block-level checks rather than on an index estimate, so there is no
  // measurement pair that could say otherwise.
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
