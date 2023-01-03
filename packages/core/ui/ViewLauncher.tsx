import React, { useState } from 'react'
import {
  Button,
  FormControl,
  MenuItem,
  Paper,
  Select,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

// locals
import {
  getEnv,
  NotificationLevel,
  SnackAction,
  SessionWithDrawerWidgets,
} from '../util'

// ui elements
import { MenuItem as JBMenuItem } from './Menu'
type SnackbarMessage = [string, NotificationLevel, SnackAction]

type AppSession = SessionWithDrawerWidgets & {
  savedSessionNames: string[]
  menus: { label: string; menuItems: JBMenuItem[] }[]
  renameCurrentSession: (arg: string) => void
  snackbarMessages: SnackbarMessage[]
  popSnackbarMessage: () => unknown
}

const useStyles = makeStyles()(theme => ({
  selectPaper: {
    padding: theme.spacing(4),
  },
}))

const ViewLauncher = observer(({ session }: { session: AppSession }) => {
  const { classes } = useStyles()
  const { pluginManager } = getEnv(session)
  const viewTypes = pluginManager.getElementTypeRecord('view').all()
  const [value, setValue] = useState(viewTypes[0]?.name)
  return (
    <Paper className={classes.selectPaper}>
      <Typography>Select a view to launch</Typography>
      <FormControl style={{ margin: 2 }}>
        <Select value={value} onChange={event => setValue(event.target.value)}>
          {viewTypes.map(({ displayName, name }) => (
            <MenuItem key={name} value={name}>
              {displayName}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl style={{ margin: 2 }}>
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
