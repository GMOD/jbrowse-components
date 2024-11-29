import React from 'react'

import { List, ListSubheader, Paper, Typography } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import SessionListItem from './SessionListItem'

import type { SessionModel } from './util'

const useStyles = makeStyles()(theme => ({
  root: {
    margin: theme.spacing(1),
  },
  message: {
    padding: theme.spacing(3),
  },
}))

const SessionManager = observer(function ({
  session,
}: {
  session: SessionModel
}) {
  const { classes } = useStyles()
  return (
    <Paper className={classes.root}>
      <List subheader={<ListSubheader>Saved sessions</ListSubheader>}>
        {session.savedSessions?.length ? (
          session.savedSessions.map(snap => (
            <SessionListItem
              key={snap.session.id}
              snap={snap}
              session={session}
              onClick={() => {
                session.activateSession(snap.session.id)
              }}
            />
          ))
        ) : (
          <Typography className={classes.message}>
            No saved sessions found
          </Typography>
        )}
      </List>
    </Paper>
  )
})

export default SessionManager
