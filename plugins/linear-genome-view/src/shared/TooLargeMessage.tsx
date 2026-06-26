import { isAlive } from '@jbrowse/mobx-state-tree'
import { Button } from '@mui/material'
import { observer } from 'mobx-react'

import BlockMsg from './BlockMsg.tsx'

export interface TooLargeMessageModel {
  regionTooLargeReason: string
  forceLoad: () => void
}

const TooLargeMessage = observer(function TooLargeMessage({
  model,
}: {
  model: TooLargeMessageModel
}) {
  const { regionTooLargeReason } = model
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
      message={[
        regionTooLargeReason,
        'Zoom in to see features or force load (may be slow)',
      ]
        .filter(f => !!f)
        .join('. ')}
    />
  )
})

export default TooLargeMessage
