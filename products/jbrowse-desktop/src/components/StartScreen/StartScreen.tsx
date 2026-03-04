import { useState } from 'react'

import { PluggableComponent } from '@jbrowse/core/ui'
import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { useFetch } from '@jbrowse/core/util/useFetch'
import MenuIcon from '@mui/icons-material/Menu'
import { Paper, Typography } from '@mui/material'

import { useNotifyError } from '../NotifyContext.ts'
import GlobalPluginsDialog from './GlobalPluginsDialog.tsx'
import Logo from './Logo.tsx'
import LeftSidePanel from './leftSidePanel/LeftSidePanel.tsx'
import RecentSessionPanel from './recentSessions/RecentSessionsPanel.tsx'
import { createStartScreenPluginManager } from './util.tsx'

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
}: {
  setPluginManager: (arg: PluginManager) => void
}) {
  const { classes } = useStyles()
  const [showGlobalPlugins, setShowGlobalPlugins] = useState(false)
  const notifyError = useNotifyError()
  // Global plugins get their own manager here: the start screen has no session,
  // so this is the only thing a plugin can extend before one is opened. The
  // start screen renders undecorated until it resolves.
  const { data: startScreenPluginManager } = useFetch(
    'createStartScreenPluginManager',
    () => createStartScreenPluginManager(),
    {
      onError: e => {
        notifyError(e)
      },
    },
  )

  return (
    <div>
      <div className={classes.menuButton}>
        <CascadingMenuButton
          menuItems={() => [
            {
              label: 'Global plugins...',
              onClick: () => {
                setShowGlobalPlugins(true)
              },
            },
            ...(startScreenPluginManager
              ? startScreenPluginManager.evaluateExtensionPoint(
                  'Desktop-StartScreenMenuItems',
                  [],
                  { pluginManager: startScreenPluginManager },
                )
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
              props={{ setPluginManager }}
            />
          ) : (
            <RecentSessionPanel setPluginManager={setPluginManager} />
          )}
        </Paper>
      </div>
      {showGlobalPlugins ? (
        <GlobalPluginsDialog
          onClose={() => {
            setShowGlobalPlugins(false)
          }}
        />
      ) : null}
    </div>
  )
}
