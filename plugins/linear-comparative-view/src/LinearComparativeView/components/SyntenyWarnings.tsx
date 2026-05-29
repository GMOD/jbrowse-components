import { useState } from 'react'

import { Alert, Button, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import type { LinearComparativeViewModel } from '../model.ts'

const SyntenyWarnings = observer(function SyntenyWarnings({
  model,
}: {
  model: LinearComparativeViewModel
}) {
  const warnings = model.levels
    .flatMap(level => level.linearSyntenyDisplays)
    .flatMap(display => display.warnings)
  const [dismissedLength, setDismissedLength] = useState(0)
  return warnings.length > dismissedLength ? (
    <Alert severity="warning">
      <Tooltip title={warnings.map(w => w.effect).join(' ')}>
        <span>{warnings.map(w => w.message).join('; ')}</span>
      </Tooltip>
      <Button
        variant="contained"
        onClick={() => {
          setDismissedLength(warnings.length)
        }}
      >
        Dismiss
      </Button>
    </Alert>
  ) : null
})

export default SyntenyWarnings
