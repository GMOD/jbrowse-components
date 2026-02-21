import { Button } from '@mui/material'
import { isAlive } from '@jbrowse/mobx-state-tree'
import { observer } from 'mobx-react'

const LDTooLargeMessage = observer(function LDTooLargeMessage({
  model,
}: {
  model: {
    regionTooLargeReason: string
    setForceLoad: (f: boolean) => void
  }
}) {
  return (
    <div style={{ padding: 8 }}>
      {model.regionTooLargeReason}{' '}
      <Button
        size="small"
        variant="outlined"
        onClick={() => {
          if (isAlive(model)) {
            model.setForceLoad(true)
          }
        }}
      >
        Force load
      </Button>{' '}
      (may be slow)
    </div>
  )
})

export default LDTooLargeMessage
