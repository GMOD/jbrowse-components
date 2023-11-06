import React from 'react'
import {
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Paper,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'

import { observer } from 'mobx-react'
import pluralize from 'pluralize'

// icons
import ViewListIcon from '@mui/icons-material/ViewList'
import { SessionModel, SessionSnap } from './util'

const useStyles = makeStyles()(theme => ({
  root: {
    margin: theme.spacing(1),
  },
  message: {
    padding: theme.spacing(3),
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
  ).session as SessionSnap

  const { views = [] } = autosavedSession || {}
  const totalTracks = views
    .map(view => view.tracks?.length ?? 0)
    .reduce((a, b) => a + b, 0)

  return autosavedSession ? (
    <Paper className={classes.root}>
      <List subheader={<ListSubheader>Previous autosaved entry</ListSubheader>}>
        <ListItem button onClick={() => session.loadAutosaveSession()}>
          <ListItemIcon>
            <ViewListIcon />
          </ListItemIcon>
          <ListItemText
            primary={autosavedSession.name}
            secondary={
              session.name === autosavedSession.name
                ? 'Currently open'
                : `${views.length} ${pluralize(
                    'view',
                    views.length,
                  )}; ${totalTracks}
                           open ${pluralize('track', totalTracks)}`
            }
          />
        </ListItem>
      </List>
    </Paper>
  ) : null
})

export default AutosaveSessionsList
