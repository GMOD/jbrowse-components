import { useState } from 'react'

import { PluggableComponent } from '@jbrowse/core/ui'
import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import MenuIcon from '@mui/icons-material/Menu'
import { Paper, Typography } from '@mui/material'

import GlobalPluginsDialog from './GlobalPluginsDialog.tsx'
import Logo from './Logo.tsx'
import LeftSidePanel from './leftSidePanel/LeftSidePanel.tsx'
import RecentSessionPanel from './recentSessions/RecentSessionsPanel.tsx'

import type PluginManager from '@jbrowse/core/PluginManager'

const useStyles = makeStyles()({
  root: {
    marginLeft: 30,
    marginRight: 30,
    marginTop: 50,
    display: 'flex',
    gap: 10,
  },

  panel: {
    flex: 1,
    padding: 16,
    minWidth: 450,
    maxWidth: 600,
  },

  recentPanel: {
    flex: 2,
    padding: 16,
    overflow: 'auto',
  },

  menuButton: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
})

export default function StartScreen({
  setPluginManager,
  setError,
  startScreenPluginManager,
}: {
  setPluginManager: (arg: PluginManager) => void
  setError: (arg: unknown) => void
  startScreenPluginManager?: PluginManager
}) {
  const { classes } = useStyles()
  const [showGlobalPlugins, setShowGlobalPlugins] = useState(false)

  return (
    <div>
      <div className={classes.menuButton}>
        <CascadingMenuButton
          menuItems={() => [
            {
              label: 'Global plugins...',
              onClick: () => setShowGlobalPlugins(true),
            },
            ...(startScreenPluginManager
              ? (startScreenPluginManager.evaluateExtensionPoint(
                  'Desktop-StartScreenMenuItems',
                  [],
                  { pluginManager: startScreenPluginManager },
                ) as { label: string; onClick: () => void }[])
              : []),
          ]}
        >
          <MenuIcon />
        </CascadingMenuButton>
      </div>
      <Logo />
      <div className={classes.root}>
        <Paper elevation={3} className={classes.panel}>
          <Typography variant="h5">Launch new session</Typography>
          {startScreenPluginManager ? (
            <PluggableComponent
              pluginManager={startScreenPluginManager}
              name="Desktop-StartScreenLaunchPanel"
              component={LeftSidePanel}
              props={{ setPluginManager }}
            />
          ) : (
            <LeftSidePanel setPluginManager={setPluginManager} />
          )}
        </Paper>
        <Paper elevation={3} className={classes.recentPanel}>
          <Typography variant="h5">Recently opened sessions</Typography>
          {startScreenPluginManager ? (
            <PluggableComponent
              pluginManager={startScreenPluginManager}
              name="Desktop-StartScreenRecentSessionsPanel"
              component={RecentSessionPanel}
              props={{ setPluginManager, setError }}
            />
          ) : (
            <RecentSessionPanel
              setPluginManager={setPluginManager}
              setError={setError}
            />
          )}
        </Paper>
      </div>
      {showGlobalPlugins ? (
        <GlobalPluginsDialog onClose={() => setShowGlobalPlugins(false)} />
      ) : null}
    </div>
  )
}
