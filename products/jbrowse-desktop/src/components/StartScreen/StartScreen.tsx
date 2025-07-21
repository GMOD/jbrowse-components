import { Paper, Typography } from '@mui/material'
import { makeStyles } from 'tss-react/mui'

import Logo from './Logo'
import LeftSidePanel from './leftSidePanel/LeftSidePanel'
import RecentSessionPanel from './recentSessions/RecentSessionsPanel'

import type PluginManager from '@jbrowse/core/PluginManager'

const useStyles = makeStyles()({
  root: {
    marginLeft: 100,
    marginRight: 100,
    marginTop: 50,
    display: 'flex',
    gap: 10,
  },

  panel: {
    flex: 1,
    padding: 16,
    minWidth: 400,
    maxWidth: 500,
  },

  recentPanel: {
    flex: 2,
    padding: 16,
    overflow: 'auto',
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
          <LeftSidePanel setPluginManager={setPluginManager} />
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
