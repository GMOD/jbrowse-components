import { Button } from '@mui/material'
import { observer } from 'mobx-react'

import type { ScoreAxisDisplay } from './types.ts'

const ResetAxisButton = observer(function ResetAxisButton({
  display,
}: {
  display: ScoreAxisDisplay
}) {
  return (
    <div>
      <Button
        variant="outlined"
        onClick={() => {
          display.resetYScale()
        }}
      >
        Reset to defaults
      </Button>
    </div>
  )
})

export default ResetAxisButton
