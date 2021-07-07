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
}))

function LockedPlugin() {
  return (
    <Tooltip
      style={{ marginRight: '0.5rem' }}
      title="This plugin was installed by an admin. It cannot be removed."
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
}: {
  plugin: BasePlugin
  model: PluginStoreModel
}) {
  const [dialogPlugin, setDialogPlugin] = useState<string>()

  const session = getSession(model)

  // @ts-ignore
  const { sessionPlugins } = session
  const isSessionPlugin = sessionPlugins?.some(
    (p: BasePlugin) => `${p.name}Plugin` === plugin.name,
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
              if (adminMode) {
                jbrowse.removePlugin(plugin.name)
              } else if (isSessionWithSessionPlugins(session)) {
                session.removeSessionPlugin(plugin.name)
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
