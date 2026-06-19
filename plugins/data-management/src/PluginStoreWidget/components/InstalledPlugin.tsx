import { lazy, useState } from 'react'

import { pluginUrl } from '@jbrowse/core/PluginLoader'
import {
  getEnv,
  getPluginUpdate,
  getSession,
  installedVersionFromUrl,
} from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { isSessionWithSessionPlugins } from '@jbrowse/core/util/types'
import DeleteIcon from '@mui/icons-material/Delete'
import LockIcon from '@mui/icons-material/Lock'
import UpgradeIcon from '@mui/icons-material/Upgrade'
import {
  Button,
  IconButton,
  ListItem,
  Tooltip,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import { isSessionPlugin } from './util.ts'

import type { PluginStoreModel } from '../model.ts'
import type { PluginDefinition } from '@jbrowse/core/PluginLoader'
import type { PluginUpdate } from '@jbrowse/core/util'
import type { BasePlugin, JBrowsePlugin } from '@jbrowse/core/util/types'

// lazies
const DeletePluginDialog = lazy(() => import('./DeletePluginDialog.tsx'))

const useStyles = makeStyles()(() => ({
  iconMargin: {
    marginRight: '0.5rem',
  },
  name: {
    marginRight: '0.5rem',
  },
}))

function LockedPluginIconButton() {
  const { classes } = useStyles()
  return (
    <Tooltip
      className={classes.iconMargin}
      title="This plugin was installed by an administrator, you cannot remove it."
    >
      <span>
        <IconButton disabled>
          <LockIcon />
        </IconButton>
      </span>
    </Tooltip>
  )
}

const UninstallPluginIconButton = observer(function UninstallPluginIconButton({
  plugin,
  model,
  definition,
}: {
  plugin: BasePlugin
  model: PluginStoreModel
  definition: PluginDefinition
}) {
  const { classes } = useStyles()
  const session = getSession(model)
  const { jbrowse, adminMode } = session
  return (
    <Tooltip className={classes.iconMargin} title="Uninstall plugin">
      <IconButton
        data-testid={`removePlugin-${plugin.name}`}
        onClick={() => {
          session.queueDialog(onClose => [
            DeletePluginDialog,
            {
              plugin: plugin.name,
              onClose: (name?: string) => {
                if (name) {
                  if (adminMode) {
                    jbrowse.removePlugin(definition)
                  } else if (isSessionWithSessionPlugins(session)) {
                    session.removeSessionPlugin(definition)
                  }
                }
                onClose()
              },
            },
          ])
        }}
      >
        <DeleteIcon />
      </IconButton>
    </Tooltip>
  )
})

const UpdatePluginButton = observer(function UpdatePluginButton({
  plugin,
  model,
  update,
  current,
  fromVersion,
}: {
  plugin: BasePlugin
  model: PluginStoreModel
  update: PluginUpdate
  current: PluginDefinition
  fromVersion?: string
}) {
  const session = getSession(model)
  const { jbrowse, adminMode } = session
  const [queued, setQueued] = useState(false)
  return (
    <Tooltip title={`Update from v${fromVersion} to v${update.pluginVersion}`}>
      <Button
        size="small"
        variant="outlined"
        startIcon={<UpgradeIcon />}
        disabled={queued}
        data-testid={`updatePlugin-${plugin.name}`}
        onClick={() => {
          // swap the version-pinned definition: remove the current url, add the
          // newer one. Both actions flag pluginsUpdated, prompting a reload that
          // loads the new build.
          const next = { ...update.definition, name: plugin.name }
          if (adminMode) {
            jbrowse.removePlugin(current)
            jbrowse.addPlugin(next)
          } else if (isSessionWithSessionPlugins(session)) {
            session.removeSessionPlugin(current)
            session.addSessionPlugin(next)
          } else {
            session.notify('No way to update plugin')
          }
          setQueued(true)
        }}
      >
        {queued ? 'Update queued' : `Update to v${update.pluginVersion}`}
      </Button>
    </Tooltip>
  )
})

const InstalledPlugin = observer(function InstalledPlugin({
  plugin,
  model,
  storeEntry,
}: {
  plugin: BasePlugin
  model: PluginStoreModel
  storeEntry?: JBrowsePlugin
}) {
  const { classes } = useStyles()
  const { pluginManager } = getEnv(model)
  const session = getSession(model)
  const { adminMode } = session
  const updatable = adminMode || isSessionPlugin(plugin, session)

  // the install url is recorded in the plugin metadata at load time; the matching
  // runtime definition is the concrete, version-pinned thing we remove/replace
  const installedUrl = pluginManager.pluginMetadata[plugin.name]?.url
  const definition = pluginManager.runtimePluginDefinitions.find(
    d => pluginUrl(d) === installedUrl,
  )
  // read the installed version from the store-minted, version-pinned url rather
  // than the plugin's self-declared version, which is optional and often unset
  const installedVersion = installedVersionFromUrl(
    installedUrl,
    storeEntry?.packageName,
  )
  const update = storeEntry
    ? getPluginUpdate(storeEntry, session.version, installedVersion)
    : undefined

  return (
    <ListItem key={plugin.name}>
      {updatable && definition ? (
        <UninstallPluginIconButton
          plugin={plugin}
          model={model}
          definition={definition}
        />
      ) : (
        <LockedPluginIconButton />
      )}
      <Typography className={classes.name}>
        {plugin.name}
        {plugin.version ? ` (v${plugin.version})` : ''}
      </Typography>
      {update && updatable && definition ? (
        <UpdatePluginButton
          plugin={plugin}
          model={model}
          update={update}
          current={definition}
          fromVersion={installedVersion}
        />
      ) : null}
    </ListItem>
  )
})

export default InstalledPlugin
