import React, { lazy } from 'react'
import { FormControl, IconButton } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

// locals
import { getSession } from '../../util'

// icons
import HelpIcon from '@mui/icons-material/Help'

// lazies
const SequencePanelHelpDialog = lazy(() => import('./SequencePanelHelpDialog'))

const useStyles = makeStyles()({
  formControl: {
    margin: 0,
  },
})

const SequencePanelHelpButton = observer(function ({
  model,
}: {
  model: unknown
}) {
  const { classes } = useStyles()
  const session = getSession(model)
  return (
    <FormControl className={classes.formControl}>
      <IconButton
        onClick={() =>
          session.queueDialog(handleClose => [
            SequencePanelHelpDialog,
            { handleClose },
          ])
        }
      >
        <HelpIcon />
      </IconButton>
    </FormControl>
  )
})

export default SequencePanelHelpButton
