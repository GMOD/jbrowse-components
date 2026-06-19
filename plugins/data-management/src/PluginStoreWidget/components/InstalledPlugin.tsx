import { lazy, useState } from 'react'

import { getEnv, getPluginUpdate, getSession } from '@jbrowse/core/util'
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
}: {
  plugin: BasePlugin
  model: PluginStoreModel
}) {
  const { classes } = useStyles()
  const { pluginManager } = getEnv(model)
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
                  const pluginMetadata =
                    pluginManager.pluginMetadata[plugin.name]

                  if (adminMode) {
                    jbrowse.removePlugin(pluginMetadata)
                  } else if (isSessionWithSessionPlugins(session)) {
                    session.removeSessionPlugin(pluginMetadata)
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
}: {
  plugin: BasePlugin
  model: PluginStoreModel
  update: PluginUpdate
}) {
  const { pluginManager } = getEnv(model)
  const session = getSession(model)
  const { jbrowse, adminMode } = session
  const [queued, setQueued] = useState(false)
  return (
    <Tooltip
      title={`Update from v${plugin.version} to v${update.pluginVersion}`}
    >
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
          const current = pluginManager.pluginMetadata[plugin.name]
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
  const session = getSession(model)
  const { adminMode } = session
  const updatable = adminMode || isSessionPlugin(plugin, session)
  const update = storeEntry
    ? getPluginUpdate(storeEntry, session.version, plugin.version)
    : undefined

  return (
    <ListItem key={plugin.name}>
      {updatable ? (
        <UninstallPluginIconButton plugin={plugin} model={model} />
      ) : (
        <LockedPluginIconButton />
      )}
      <Typography className={classes.name}>
        {plugin.name}
        {plugin.version ? ` (v${plugin.version})` : ''}
      </Typography>
      {update && updatable ? (
        <UpdatePluginButton plugin={plugin} model={model} update={update} />
      ) : null}
    </ListItem>
  )
})

export default InstalledPlugin
