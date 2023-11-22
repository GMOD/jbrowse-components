import React from 'react'
import { List, ListSubheader, Paper } from '@mui/material'
import { makeStyles } from 'tss-react/mui'

import { observer } from 'mobx-react'

// icons
import { SessionModel, SessionSnap } from './util'
import SessionListItem from './SessionListItem'

const useStyles = makeStyles()(theme => ({
  root: {
    margin: theme.spacing(1),
  },
}))

const AutosaveSessionsList = observer(function ({
  session,
}: {
  session: SessionModel
}) {
  const { classes } = useStyles()
  const autosavedSession = undefined

  return autosavedSession ? (
    <Paper className={classes.root}>
      <List subheader={<ListSubheader>Previous autosaved entry</ListSubheader>}>
        <SessionListItem
          session={session}
          sessionSnapshot={autosavedSession}
          onClick={() => session.loadAutosaveSession()}
        />
      </List>
    </Paper>
  ) : null
})

export default AutosaveSessionsList
