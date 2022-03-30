import React from 'react'
import { Grid, Paper, Typography, makeStyles } from '@material-ui/core'

import { LogoFull } from '@jbrowse/core/ui/Logo'
import PluginManager from '@jbrowse/core/PluginManager'

// locals
import LauncherPanel from './LauncherPanel'
import RecentSessionPanel from './RecentSessionsPanel'

import packageJSON from '../../package.json'

const useStyles = makeStyles(theme => ({
  root: {
    marginLeft: 100,
    marginRight: 100,
    flexGrow: 1,
  },
  formControl: {
    margin: theme.spacing(1),
    minWidth: 120,
    maxWidth: 300,
  },
  panel: {
    margin: theme.spacing(1),
    padding: theme.spacing(4),
  },

  settings: {
    float: 'right',
  },
  logo: {
    margin: '0 auto',
    width: 500,
  },
}))

function LogoWithVersion() {
  const classes = useStyles()
  return (
    <div className={classes.logo}>
      <LogoFull />
      <Typography variant="h6" style={{ float: 'right' }}>
        v{packageJSON.version}
      </Typography>
    </div>
  )
}
export default function StartScreen({
  setPluginManager,
  setError,
}: {
  setPluginManager: (arg: PluginManager) => void
  setError: (arg: unknown) => void
}) {
  const classes = useStyles()

  return (
    <div>
      <LogoWithVersion />

      <div className={classes.root}>
        <Grid container spacing={3}>
          <Grid item xs={4}>
            <Paper elevation={6} className={classes.panel}>
              <Typography variant="h5">Launch new session</Typography>
              <LauncherPanel setPluginManager={setPluginManager} />
            </Paper>
          </Grid>
          <Grid item xs={8}>
            <Paper elevation={6} className={classes.panel}>
              <Typography variant="h5">Recently opened sessions</Typography>
              <RecentSessionPanel
                setPluginManager={setPluginManager}
                setError={setError}
              />
            </Paper>
          </Grid>
        </Grid>
      </div>
    </div>
  )
}
