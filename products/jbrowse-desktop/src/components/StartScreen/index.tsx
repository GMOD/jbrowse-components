import { Paper, Typography } from '@mui/material'
import { makeStyles } from 'tss-react/mui'

import LauncherPanel from './LauncherPanel'
import Logo from './Logo'
import RecentSessionPanel from './RecentSessionsPanel'

import type PluginManager from '@jbrowse/core/PluginManager'

const useStyles = makeStyles()({
  root: {
    marginLeft: 100,
    marginRight: 100,
    marginTop: 100,
    display: 'flex',
    gap: 10,
  },

  panel: {
    flex: 1,
    padding: 16,
    maxWidth: 400,
  },

  recentPanel: {
    flex: 2,
    padding: 16,
  },
})

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
        <Paper elevation={3} className={classes.panel}>
          <Typography variant="h5">Launch new session</Typography>
          <LauncherPanel setPluginManager={setPluginManager} />
        </Paper>
        <Paper elevation={3} className={classes.recentPanel}>
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
