import React, { useState } from 'react'
import { observer } from 'mobx-react'
import { getParent } from 'mobx-state-tree'

import { makeStyles } from '@material-ui/core/styles'
import {
  Button,
  Dialog,
  DialogTitle,
  DialogActions,
  DialogContent,
  IconButton,
  ListItem,
  Tooltip,
  Typography,
} from '@material-ui/core'

import CloseIcon from '@material-ui/icons/Close'
import LockIcon from '@material-ui/icons/Lock'

import PluginManager from '@jbrowse/core/PluginManager'
import { getSession } from '@jbrowse/core/util'
import { BasePlugin } from '@jbrowse/core/util/types'
import { isSessionWithSessionPlugins } from '@jbrowse/core/util/types'
import { PluginStoreModel } from '../model'

const useStyles = makeStyles(() => ({
  closeDialog: {
    position: 'absolute',
    right: 0,
    top: 0,
  },
  dialogContainer: {
    margin: 15,
  },
  lockedPluginTooltip: {
    marginRight: '0.5rem',
  },
}))

function LockedPlugin() {
  const classes = useStyles()
  return (
    <Tooltip
      className={classes.lockedPluginTooltip}
      title="This plugin was installed by an administrator, you cannot remove it."
    >
      <LockIcon />
    </Tooltip>
  )
}

function PluginDialog({
  onClose,
  plugin,
}: {
  plugin: string
  onClose: (s?: string) => void
}) {
  const classes = useStyles()
  return (
    <Dialog open onClose={() => onClose()}>
      <DialogTitle>
        <IconButton
          className={classes.closeDialog}
          aria-label="close-dialog"
          onClick={() => onClose()}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Typography>
          Please confirm that you want to remove {plugin}:
        </Typography>
        <DialogActions>
          <Button
            variant="contained"
            color="primary"
            onClick={() => {
              // avoid showing runtime plugin warning
              window.setTimeout(() => {
                onClose(plugin)
              }, 500)
            }}
          >
            Confirm
          </Button>
          <Button
            variant="contained"
            color="secondary"
            onClick={() => {
              onClose()
            }}
          >
            Cancel
          </Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  )
}

function InstalledPlugin({
  plugin,
  model,
  pluginManager,
}: {
  plugin: BasePlugin
  model: PluginStoreModel
  pluginManager: PluginManager
}) {
  const [dialogPlugin, setDialogPlugin] = useState<string>()

  const session = getSession(model)

  // @ts-ignore
  const { sessionPlugins } = session
  const isSessionPlugin = sessionPlugins?.some(
    (p: BasePlugin) => pluginManager.pluginMetadata[plugin.name].url === p.url,
  )

  const rootModel = getParent(model, 3)
  const { jbrowse, adminMode } = rootModel

  return (
    <>
      {dialogPlugin ? (
        <PluginDialog
          plugin={dialogPlugin}
          onClose={name => {
            if (name) {
              const pluginMetadata = pluginManager.pluginMetadata[plugin.name]
              const pluginUrl = pluginMetadata.url
              if (adminMode) {
                jbrowse.removePlugin(pluginUrl)
              } else if (isSessionWithSessionPlugins(session)) {
                session.removeSessionPlugin(pluginUrl)
              }
            }
            setDialogPlugin(undefined)
          }}
        />
      ) : null}
      <ListItem key={plugin.name}>
        {adminMode || isSessionPlugin ? (
          <IconButton
            aria-label="removePlugin"
            data-testid={`removePlugin-${plugin.name}`}
            onClick={() => setDialogPlugin(plugin.name)}
          >
            <CloseIcon />
          </IconButton>
        ) : (
          <LockedPlugin />
        )}
        <Typography>{plugin.name}</Typography>
      </ListItem>
    </>
  )
}

export default observer(InstalledPlugin)
