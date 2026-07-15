import { lazy } from 'react'

import { getSession } from '@jbrowse/core/util'
import ReportProblemIcon from '@mui/icons-material/ReportProblemOutlined'
import { IconButton, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import type { LinearComparativeViewModel } from '../model.ts'

const SyntenyWarningsDialog = lazy(() => import('./SyntenyWarningsDialog.tsx'))

const SyntenyWarnings = observer(function SyntenyWarnings({
  model,
}: {
  model: LinearComparativeViewModel
}) {
  const warnings = model.levels
    .flatMap(level => level.linearSyntenyDisplays)
    .flatMap(display => display.warnings)

  return warnings.length ? (
    <Tooltip
      title={`${warnings.length} synteny warning${warnings.length > 1 ? 's' : ''} — click for details`}
    >
      <IconButton
        color="warning"
        style={{ marginLeft: 'auto' }}
        onClick={() => {
          getSession(model).queueDialog(handleClose => [
            SyntenyWarningsDialog,
            { model, handleClose },
          ])
        }}
      >
        <ReportProblemIcon />
      </IconButton>
    </Tooltip>
  ) : null
})

export default SyntenyWarnings
