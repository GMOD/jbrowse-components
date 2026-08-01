// imported for the module augmentation that types the extension points the
// panels and menu below fire
import './startScreenExtensionPoints.ts'

import { useState } from 'react'

import {
  pluginDescriptionString,
  pluginUrl,
} from '@jbrowse/core/pluginDefinitions'
import { PluggableComponent } from '@jbrowse/core/ui'
import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { ErrorBoundary } from '@jbrowse/core/ui/ErrorBoundary'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { useFetch } from '@jbrowse/core/util/useFetch'
import MenuIcon from '@mui/icons-material/Menu'
import { Alert, Button, Paper, Typography } from '@mui/material'

import { useNotifyError } from '../NotifyContext.ts'
import GlobalPluginsDialog from './GlobalPluginsDialog.tsx'
import Logo from './Logo.tsx'
import {
  globalPluginSafeMode,
  reloadInSafeMode,
  reloadWithGlobalPlugins,
} from './globalPlugins.ts'
import LeftSidePanel from './leftSidePanel/LeftSidePanel.tsx'
import RecentSessionPanel from './recentSessions/RecentSessionsPanel.tsx'
import { createStartScreenPluginManager, loadPluginManager } from './util.tsx'

import type { StartScreenPanelProps } from './startScreenExtensionPoints.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { MenuItem } from '@jbrowse/core/ui'

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

  banner: {
    margin: 16,
  },
})

/**
 * A panel a global plugin may have replaced. The plugin's component renders
 * inside an error boundary falling back to the one JBrowse ships: the panels
 * are how a session gets opened, so a plugin that throws while rendering one
 * must not take the start screen — and with it the dialog that could remove
 * that plugin — down with it.
 */
function PluginReplaceablePanel({
  children,
  fallback,
}: {
  children: React.ReactNode
  fallback: React.ReactNode
}) {
  return (
    <ErrorBoundary
      FallbackComponent={() => (
        <>
          <Alert severity="error">
            A global plugin failed while rendering this panel. Remove it from
            the menu&apos;s &quot;Global plugins&quot; dialog, or reload without
            global plugins.
          </Alert>
          {fallback}
        </>
      )}
    >
      {children}
    </ErrorBoundary>
  )
}

// A global plugin's callback runs here, during the start screen's render, so
// one that throws would leave the user with no start screen and no way to
// uninstall it. The menu items it contributes are worth less than that, so a
// throw costs the plugin its menu items and nothing else.
function pluginMenuItems(
  pluginManager: PluginManager | undefined,
  props: StartScreenPanelProps,
) {
  let items: MenuItem[] = []
  if (pluginManager) {
    try {
      items = pluginManager.evaluateExtensionPoint(
        'Desktop-StartScreenMenuItems',
        [],
        { pluginManager, ...props },
      )
    } catch (e) {
      console.error(e)
    }
  }
  return items
}

export default function StartScreen({
  setPluginManager,
}: {
  setPluginManager: (arg: PluginManager) => void
}) {
  const { classes } = useStyles()
  const [showGlobalPlugins, setShowGlobalPlugins] = useState(false)
  const notifyError = useNotifyError()
  const safeMode = globalPluginSafeMode()
  // Global plugins get their own manager here: the start screen has no session,
  // so this is the only thing a plugin can extend before one is opened. The
  // start screen renders undecorated until it resolves.
  const { data } = useFetch(
    'createStartScreenPluginManager',
    () => createStartScreenPluginManager(),
    {
      onError: e => {
        notifyError(e)
      },
      // a global plugin that no longer loads is the user's to fix, and the
      // start screen is the one place they can: report it with the way out
      onSuccess: ({ failures }) => {
        for (const { definition, error } of failures) {
          console.error(error)
          notifyError(
            new Error(
              `Failed to load global plugin ${pluginDescriptionString(definition)} from ${pluginUrl(definition)}`,
              { cause: error },
            ),
            {
              label: 'Manage global plugins',
              onClick: () => {
                setShowGlobalPlugins(true)
              },
            },
          )
        }
      },
    },
  )
  const startScreenPluginManager = data?.pluginManager
  const panelProps = { setPluginManager, loadPluginManager }

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
            safeMode
              ? {
                  label: 'Reload with global plugins',
                  onClick: () => {
                    reloadWithGlobalPlugins()
                  },
                }
              : {
                  label: 'Reload without global plugins',
                  onClick: () => {
                    reloadInSafeMode()
                  },
                },
            ...pluginMenuItems(startScreenPluginManager, panelProps),
          ]}
        >
          <MenuIcon />
        </CascadingMenuButton>
      </div>
      <Logo />
      {safeMode ? (
        <Alert
          severity="info"
          className={classes.banner}
          action={
            <>
              <Button
                onClick={() => {
                  setShowGlobalPlugins(true)
                }}
              >
                Manage
              </Button>
              <Button
                onClick={() => {
                  reloadWithGlobalPlugins()
                }}
              >
                Re-enable
              </Button>
            </>
          }
        >
          {safeMode === 'requested'
            ? 'Global plugins are disabled for this launch.'
            : 'Global plugins were disabled because the last launch did not finish loading them.'}
        </Alert>
      ) : null}
      <div className={classes.root}>
        <Paper elevation={3} className={classes.panel}>
          <Typography variant="h5">Launch new session</Typography>
          {startScreenPluginManager ? (
            <PluginReplaceablePanel
              fallback={<LeftSidePanel {...panelProps} />}
            >
              <PluggableComponent
                pluginManager={startScreenPluginManager}
                name="Desktop-StartScreenLaunchPanel"
                component={LeftSidePanel}
                props={panelProps}
              />
            </PluginReplaceablePanel>
          ) : (
            <LeftSidePanel {...panelProps} />
          )}
        </Paper>
        <Paper elevation={3} className={classes.recentPanel}>
          <Typography variant="h5">Recently opened sessions</Typography>
          {startScreenPluginManager ? (
            <PluginReplaceablePanel
              fallback={<RecentSessionPanel {...panelProps} />}
            >
              <PluggableComponent
                pluginManager={startScreenPluginManager}
                name="Desktop-StartScreenRecentSessionsPanel"
                component={RecentSessionPanel}
                props={panelProps}
              />
            </PluginReplaceablePanel>
          ) : (
            <RecentSessionPanel {...panelProps} />
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
