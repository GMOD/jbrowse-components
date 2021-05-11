import React, { useState } from 'react'
import { observer } from 'mobx-react'
import { getSnapshot, getParent } from 'mobx-state-tree'

import { makeStyles } from '@material-ui/core/styles'
import ListItem from '@material-ui/core/ListItem'
import Typography from '@material-ui/core/Typography'
import Dialog from '@material-ui/core/Dialog'
import DialogTitle from '@material-ui/core/DialogTitle'
import Button from '@material-ui/core/Button'
import Tooltip from '@material-ui/core/Tooltip'

import IconButton from '@material-ui/core/IconButton'
import CloseIcon from '@material-ui/icons/Close'
import LockIcon from '@material-ui/icons/Lock'

import { getSession } from '@jbrowse/core/util'
import type { BasePlugin } from '@jbrowse/core/util/types'
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

function InstalledPlugin({
  plugin,
  model,
}: {
  plugin: BasePlugin
  model: PluginStoreModel
}) {
  const classes = useStyles()

  const [dialogOpen, setDialogOpen] = useState(false)

  const session = getSession(model)
  const sessionSnapShot = getSnapshot(session)
  const { sessionPlugins } = sessionSnapShot
  const isSessionPlugin = sessionPlugins?.some(
    (p: BasePlugin) => `${p.name}Plugin` === plugin.name,
  )

  const rootModel = getParent(model, 3)
  const { jbrowse, adminMode } = rootModel

  return (
    <>
      <ListItem key={plugin.name}>
        {adminMode || isSessionPlugin ? (
          <IconButton
            aria-label="removePlugin"
            data-testid={`removePlugin-${plugin.name}`}
            onClick={() => setDialogOpen(true)}
          >
            <CloseIcon />
          </IconButton>
        ) : (
          <LockedPlugin />
        )}
        <Typography>{plugin.name}</Typography>
      </ListItem>
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <DialogTitle>
          <IconButton
            className={classes.closeDialog}
            aria-label="close-dialog"
            onClick={() => setDialogOpen(false)}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <div className={classes.dialogContainer}>
          <>
            <Typography>
              Please confirm that you want to remove {plugin.name}:
            </Typography>
            <br />
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Button
                variant="contained"
                color="primary"
                onClick={() => {
                  setDialogOpen(false)
                  // avoid showing runtime plugin warning
                  window.setTimeout(() => {
                    if (adminMode) {
                      jbrowse.removePlugin(plugin.name)
                    } else if (isSessionWithSessionPlugins(session)) {
                      session.removeSessionPlugin(plugin.name)
                    }
                  }, 500)
                }}
              >
                Confirm
              </Button>
            </div>
          </>
        </div>
      </Dialog>
    </>
  )
}

export default observer(InstalledPlugin)
