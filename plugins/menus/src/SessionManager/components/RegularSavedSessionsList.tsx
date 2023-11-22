import React, { useState } from 'react'
import {
  IconButton,
  List,
  ListSubheader,
  Paper,
  Typography,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'

import { observer } from 'mobx-react'

// icons
import DeleteIcon from '@mui/icons-material/Delete'

// locals
import { SessionModel } from './util'
import DeleteSavedSessionDialog from './DeleteSavedSessionDialog'
import SessionListItem from './SessionListItem'

const useStyles = makeStyles()(theme => ({
  root: {
    margin: theme.spacing(1),
  },
  message: {
    padding: theme.spacing(3),
  },
}))

const RegularSavedSessionsList = observer(function ({
  session,
}: {
  session: SessionModel
}) {
  const { classes } = useStyles()
  const [sessionIdxToDelete, setSessionIdxToDelete] = useState<number>()
  const { savedSessions } = session

  const sessionNameToDelete =
    sessionIdxToDelete !== undefined
      ? savedSessions[sessionIdxToDelete].name
      : ''
  return (
    <Paper className={classes.root}>
      <List subheader={<ListSubheader>Saved sessions</ListSubheader>}>
        {savedSessions.length ? (
          savedSessions.map((sessionSnapshot, idx) => (
            <SessionListItem
              onClick={() => session.activateSession(sessionSnapshot.name)}
              sessionSnapshot={sessionSnapshot}
              session={session}
              key={sessionSnapshot.name}
              secondaryAction={
                <IconButton
                  edge="end"
                  disabled={session.name === sessionSnapshot.name}
                  onClick={() => setSessionIdxToDelete(idx)}
                >
                  <DeleteIcon />
                </IconButton>
              }
            />
          ))
        ) : (
          <Typography className={classes.message}>
            No saved sessions found
          </Typography>
        )}
      </List>
      {sessionNameToDelete ? (
        <React.Suspense fallback={null}>
          <DeleteSavedSessionDialog
            open
            sessionNameToDelete={sessionNameToDelete}
            handleClose={deleteSession => {
              if (deleteSession && sessionIdxToDelete !== undefined) {
                session.removeSavedSession(savedSessions[sessionIdxToDelete])
              }
              setSessionIdxToDelete(undefined)
            }}
          />
        </React.Suspense>
      ) : null}
    </Paper>
  )
})

export default RegularSavedSessionsList
