import React from 'react'
import { List, ListSubheader, Paper } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

// icons
import SessionListItem from './SessionListItem'
import type { SessionModel, SessionSnap } from './util'

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
  const autosavedSession = JSON.parse(
    localStorage.getItem(session.previousAutosaveId) || '{}',
  ).session as SessionSnap | undefined

  return autosavedSession ? (
    <Paper className={classes.root}>
      <List subheader={<ListSubheader>Previous autosaved entry</ListSubheader>}>
        <SessionListItem
          session={session}
          sessionSnapshot={autosavedSession}
          onClick={() => {
            session.loadAutosaveSession()
          }}
        />
      </List>
    </Paper>
  ) : null
})

export default AutosaveSessionsList
