import { tooLargeBannerText } from '@jbrowse/display-ui'
import { isAlive } from '@jbrowse/mobx-state-tree'
import { Button } from '@mui/material'
import { observer } from 'mobx-react'

import BlockMsg from './BlockMsg.tsx'

import type { TooLargeMessageModel } from '@jbrowse/display-ui'

// Shape with the contract, re-exported here — see DisplayErrorBar.tsx. Every
// field is required: reaching the `tooLarge` phase at all means a display
// composes `RegionTooLargeMixin`, so there is no in-tree model without them.
export type { TooLargeMessageModel }

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
