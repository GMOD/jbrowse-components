import React, { lazy, useState } from 'react'

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

import SessionListItem from './SessionListItem'

import type { SessionModel } from './util'

// lazies
const DeleteSavedSessionDialog = lazy(
  () => import('./DeleteSavedSessionDialog'),
)

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
  const [sessionIndexToDelete, setSessionIndexToDelete] = useState<number>()

  return (
    <Paper className={classes.root}>
      <List subheader={<ListSubheader>Saved sessions</ListSubheader>}>
        {session.savedSessions?.length ? (
          session.savedSessions.map((sessionSnapshot, idx) => (
            <SessionListItem
              key={sessionSnapshot.name}
              onClick={() => {
                session.activateSession(sessionSnapshot.name)
              }}
              sessionSnapshot={sessionSnapshot}
              session={session}
              secondaryAction={
                <IconButton
                  edge="end"
                  disabled={session.name === sessionSnapshot.name}
                  onClick={() => {
                    session.queueDialog(onClose => [
                      DeleteSavedSessionDialog,
                      {
                        handleClose: (deleteSession = false) => {
                          if (
                            deleteSession &&
                            sessionIndexToDelete !== undefined
                          ) {
                            alert('todo')
                            // session.removeSavedSession(
                            //   session.savedSessions?.[sessionIndexToDelete]!,
                            // )
                          }
                          setSessionIndexToDelete(undefined)
                          onClose()
                        },
                        sessionNameToDelete: sessionSnapshot.name,
                      },
                    ])
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
    </Paper>
  )
})

export default SessionManager
