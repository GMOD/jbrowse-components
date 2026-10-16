import { isLiveModel, tooLargeBannerText } from '@jbrowse/display-ui'
import { Button } from '@mui/material'
import { observer } from 'mobx-react'

import BlockMsg from './BlockMsg.tsx'

import type { TooLargeMessageModel } from '@jbrowse/display-ui'

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
            if (isLiveModel(model)) {
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
