import { Grid2, Paper, Typography } from '@mui/material'
import { makeStyles } from 'tss-react/mui'

import LauncherPanel from './LauncherPanel'
import Logo from './Logo'
import RecentSessionPanel from './RecentSessionsPanel'

import type PluginManager from '@jbrowse/core/PluginManager'

const useStyles = makeStyles()(theme => ({
  root: {
    marginLeft: 100,
    marginRight: 100,
    display: 'flex',
    gap: theme.spacing(2),
  },

  panel: {
    padding: theme.spacing(4),
  },

  launchPanel: {
    flex: 1,
  },

  recentPanel: {
    flex: 2,
  },
}))

export default function StartScreen({
  setPluginManager,
  setError,
}: {
  setPluginManager: (arg: PluginManager) => void
  setError: (arg: unknown) => void
}) {
  const { classes } = useStyles()

  return (
    <div>
      <Logo />

      <div className={classes.root}>
        <Paper
          elevation={6}
          className={`${classes.panel} ${classes.launchPanel}`}
        >
          <Typography variant="h5">Launch new session</Typography>
          <LauncherPanel setPluginManager={setPluginManager} />
        </Paper>
        <Paper
          elevation={6}
          className={`${classes.panel} ${classes.recentPanel}`}
        >
          <Typography variant="h5">Recently opened sessions</Typography>
          <RecentSessionPanel
            setPluginManager={setPluginManager}
            setError={setError}
          />
        </Paper>
      </div>
    </div>
  )
}
