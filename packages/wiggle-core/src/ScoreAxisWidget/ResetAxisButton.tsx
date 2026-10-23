import { Button } from '@mui/material'
import { observer } from 'mobx-react'

import type { ScoreAxisDisplay } from './types.ts'

const ResetAxisButton = observer(function ResetAxisButton({
  display,
  onReset,
}: {
  display: ScoreAxisDisplay
  onReset: () => void
}) {
  return (
    <div>
      <Button
        variant="outlined"
        size="small"
        onClick={() => {
          display.resetYScale()
          onReset()
        }}
      >
        Reset to defaults
      </Button>
    </div>
  )
})

export default ResetAxisButton
