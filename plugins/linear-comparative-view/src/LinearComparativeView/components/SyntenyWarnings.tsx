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
  const key = warnings.map(w => w.message).join('; ')
  // Track the dismissed content, not the count: a different warning set of the
  // same length must still re-show.
  const [dismissedKey, setDismissedKey] = useState('')
  return key && key !== dismissedKey ? (
    <Alert severity="warning">
      <Tooltip title={warnings.map(w => w.effect).join(' ')}>
        <span>{key}</span>
      </Tooltip>
      <Button
        variant="contained"
        onClick={() => {
          setDismissedKey(key)
        }}
      >
        Dismiss
      </Button>
    </Alert>
  ) : null
})

export default SyntenyWarnings
