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
  globalPluginReadErrorMessage,
  globalPluginSafeMode,
  globalPluginSafeModeSuspects,
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
    // a window too narrow for both used to hold the launch panel at its minimum
    // and crush the recent-sessions panel, which has the wider content of the
    // two; stack them instead
    flexWrap: 'wrap',
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
    minWidth: 450,
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
 * One of the start screen's panels, as the extension point named by `name` left
 * it: JBrowse's own component unless a global plugin replaced it.
 *
 * A replacement renders inside an error boundary falling back to the component
 * JBrowse ships. The panels are how a session gets opened, so a plugin that
 * throws while rendering one must not take the start screen — and with it the
 * dialog that could remove that plugin — down with it. With no start screen
 * plugin manager (it is still loading, or failed to build) there is nothing to
 * dispatch to and the shipped component renders directly.
 */
function StartScreenPanel({
  pluginManager,
  name,
  component: Component,
  props,
}: {
  pluginManager: PluginManager | undefined
  name:
    | 'Desktop-StartScreenLaunchPanel'
    | 'Desktop-StartScreenRecentSessionsPanel'
  component: React.ComponentType<StartScreenPanelProps>
  props: StartScreenPanelProps
}) {
  return pluginManager ? (
    <ErrorBoundary
      FallbackComponent={() => (
        <>
          <Alert severity="error">
            A global plugin failed while rendering this panel. Remove it from
            the menu&apos;s &quot;Global plugins&quot; dialog, or reload without
            global plugins.
          </Alert>
          <Component {...props} />
        </>
      )}
    >
      <PluggableComponent
        pluginManager={pluginManager}
        name={name}
        component={Component}
        props={props}
      />
    </ErrorBoundary>
  ) : (
    <Component {...props} />
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
  const suspects = globalPluginSafeModeSuspects()
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
      onSuccess: ({ failures, readError }) => {
        const manage = {
          label: 'Manage global plugins',
          onClick: () => {
            setShowGlobalPlugins(true)
          },
        }
        for (const { definition, error } of failures) {
          console.error(error)
          notifyError(
            new Error(
              `Failed to load global plugin ${pluginDescriptionString(definition)} from ${pluginUrl(definition)}`,
              { cause: error },
            ),
            manage,
          )
        }
        if (readError) {
          notifyError(
            new Error(globalPluginReadErrorMessage, { cause: readError }),
            manage,
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
          {/* Named because a name is what the user can act on: switch that one
          off in the dialog and leave the rest loading. With more than one there
          is no telling which of them it was, but a list of three to bisect is
          still a great deal better than "something went wrong". */}
          {suspects.length > 0 ? (
            <>
              {suspects.length === 1
                ? ' It was loading: '
                : ' It was loading these, one of which is likely responsible: '}
              {suspects.join(', ')}
            </>
          ) : null}
        </Alert>
      ) : null}
      <div className={classes.root}>
        <Paper elevation={3} className={classes.panel}>
          <Typography variant="h5">Launch new session</Typography>
          <StartScreenPanel
            pluginManager={startScreenPluginManager}
            name="Desktop-StartScreenLaunchPanel"
            component={LeftSidePanel}
            props={panelProps}
          />
        </Paper>
        <Paper elevation={3} className={classes.recentPanel}>
          <Typography variant="h5">Recently opened sessions</Typography>
          <StartScreenPanel
            pluginManager={startScreenPluginManager}
            name="Desktop-StartScreenRecentSessionsPanel"
            component={RecentSessionPanel}
            props={panelProps}
          />
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
