import { useState } from 'react'

import { getEnv } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  Button,
  FormControl,
  MenuItem,
  Paper,
  Select,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import type { SnackbarMessage } from '@jbrowse/core/ui/SnackbarModel'
import type { SessionWithDrawerWidgets } from '@jbrowse/core/util'

type AppSession = SessionWithDrawerWidgets & {
  snackbarMessages: SnackbarMessage[]
  renameCurrentSession: (arg: string) => void
  popSnackbarMessage: () => unknown
}

const useStyles = makeStyles()(theme => ({
  selectPaper: {
    padding: theme.spacing(4),
  },
  m2: {
    margin: 2,
  },
}))

const ViewLauncher = observer(function ViewLauncher({
  session,
}: {
  session: AppSession
}) {
  const { classes } = useStyles()
  const { pluginManager } = getEnv(session)
  const viewTypes = pluginManager.getViewElements()
  const [value, setValue] = useState(viewTypes[0]?.name || '')
  return (
    <Paper className={classes.selectPaper}>
      <Typography>Select a view to launch</Typography>
      <FormControl className={classes.m2}>
        <Select
          value={value}
          onChange={event => {
            setValue(event.target.value)
          }}
        >
          {viewTypes
            .filter(({ viewMetadata }) => !viewMetadata.hiddenFromGUI)
            .map(({ displayName, name }) => (
              <MenuItem key={name} value={name}>
                {displayName}
              </MenuItem>
            ))}
        </Select>
      </FormControl>
      <FormControl className={classes.m2}>
        <Button
          onClick={() => session.addView(value, {})}
          variant="contained"
          color="primary"
        >
          Launch view
        </Button>
      </FormControl>
    </Paper>
  )
})

export default ViewLauncher
