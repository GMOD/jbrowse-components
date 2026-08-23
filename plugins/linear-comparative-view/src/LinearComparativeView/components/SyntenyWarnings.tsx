import { lazy } from 'react'

import { getDialogHost, pluralize } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import ReportProblemIcon from '@mui/icons-material/ReportProblemOutlined'
import { IconButton, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import type { LinearComparativeViewModel } from '../model.ts'

const SyntenyWarningsDialog = lazy(() => import('./SyntenyWarningsDialog.tsx'))

const useStyles = makeStyles()({
  // sits at the far end of the header bar, away from the controls
  endOfBar: {
    marginLeft: 'auto',
  },
})

const SyntenyWarnings = observer(function SyntenyWarnings({
  model,
}: {
  model: LinearComparativeViewModel
}) {
  const { classes } = useStyles()
  const { syntenyWarnings: warnings } = model

  return warnings.length ? (
    <Tooltip
      title={`${warnings.length} synteny ${pluralize(warnings.length, 'warning')} — click for details`}
    >
      <IconButton
        color="warning"
        className={classes.endOfBar}
        onClick={() => {
          getDialogHost(model).queueDialog(handleClose => [
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
