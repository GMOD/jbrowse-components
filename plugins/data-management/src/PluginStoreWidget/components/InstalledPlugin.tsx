import { lazy } from 'react'

import { getEnv, getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { isSessionWithSessionPlugins } from '@jbrowse/core/util/types'
import DeleteIcon from '@mui/icons-material/Delete'
import LockIcon from '@mui/icons-material/Lock'
import { IconButton, ListItem, Tooltip, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { isSessionPlugin } from './util.ts'

import type { PluginStoreModel } from '../model.ts'
import type { BasePlugin } from '@jbrowse/core/util/types'

// lazies
const DeletePluginDialog = lazy(() => import('./DeletePluginDialog.tsx'))

const useStyles = makeStyles()(() => ({
  iconMargin: {
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

const InstalledPlugin = observer(function InstalledPlugin({
  plugin,
  model,
}: {
  plugin: BasePlugin
  model: PluginStoreModel
}) {
  const session = getSession(model)
  const { adminMode } = session

  return (
    <ListItem key={plugin.name}>
      {adminMode || isSessionPlugin(plugin, session) ? (
        <UninstallPluginIconButton plugin={plugin} model={model} />
      ) : (
        <LockedPluginIconButton />
      )}
      <Typography>
        {[plugin.name, plugin.version ? `(v${plugin.version})` : '']
          .filter(f => !!f)
          .join(' ')}
      </Typography>
    </ListItem>
  )
})

export default InstalledPlugin
