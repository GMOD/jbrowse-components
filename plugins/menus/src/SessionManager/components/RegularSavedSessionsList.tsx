import React, { useState } from 'react'
import DeleteIcon from '@mui/icons-material/Delete'
import {
  IconButton,
  List,
  ListSubheader,
  Paper,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

// icons

// locals
import DeleteSavedSessionDialog from './DeleteSavedSessionDialog'
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

const RegularSavedSessionsList = observer(function ({
  session,
}: {
  session: SessionModel
}) {
  const { classes } = useStyles()
  const [sessionIndexToDelete, setSessionIndexToDelete] = useState<number>()

  function handleDialogClose(deleteSession = false) {
    if (deleteSession && sessionIndexToDelete !== undefined) {
      session.removeSavedSession(session.savedSessions[sessionIndexToDelete]!)
    }
    setSessionIndexToDelete(undefined)
  }

  const sessionNameToDelete =
    sessionIndexToDelete !== undefined
      ? session.savedSessions[sessionIndexToDelete]!.name
      : ''
  return (
    <Paper className={classes.root}>
      <List subheader={<ListSubheader>Saved sessions</ListSubheader>}>
        {session.savedSessions.length ? (
          session.savedSessions.map((sessionSnapshot, idx) => (
            <SessionListItem
              onClick={() => {
                session.activateSession(sessionSnapshot.name)
              }}
              sessionSnapshot={sessionSnapshot}
              session={session}
              key={sessionSnapshot.name}
              secondaryAction={
                <IconButton
                  edge="end"
                  disabled={session.name === sessionSnapshot.name}
                  onClick={() => {
                    setSessionIndexToDelete(idx)
                  }}
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
            handleClose={handleDialogClose}
          />
        </React.Suspense>
      ) : null}
    </Paper>
  )
})

export default RegularSavedSessionsList
