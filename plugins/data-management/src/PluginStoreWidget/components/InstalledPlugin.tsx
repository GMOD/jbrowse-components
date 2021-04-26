/* eslint-disable react/prop-types */
import React, { useState } from 'react'
import { observer } from 'mobx-react'
import { getSnapshot, getParent } from 'mobx-state-tree'

import { makeStyles } from '@material-ui/core/styles'
import ListItem from '@material-ui/core/ListItem'
import Typography from '@material-ui/core/Typography'
import Link from '@material-ui/core/Link'
import Dialog from '@material-ui/core/Dialog'
import DialogTitle from '@material-ui/core/DialogTitle'
import Button from '@material-ui/core/Button'

import IconButton from '@material-ui/core/IconButton'
import CloseIcon from '@material-ui/icons/Close'
import ErrorOutlineIcon from '@material-ui/icons/ErrorOutline'

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
  const isSessionPlugin = sessionPlugins.some(
    (p: BasePlugin) => `${p.name}Plugin` === plugin.name,
  )

  const rootModel = getParent(model, 3)
  const { jbrowse, adminMode } = rootModel

  return (
    <>
      <ListItem key={plugin.name}>
        <IconButton aria-label="remove" onClick={() => setDialogOpen(true)}>
          <CloseIcon />
        </IconButton>
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
          {adminMode || isSessionPlugin ? (
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
                    // wait for session autorun to handle removing session
                    window.setTimeout(() => {
                      window.location.reload()
                    }, 1000)
                  }}
                >
                  Confirm
                </Button>
              </div>
            </>
          ) : (
            <>
              <ErrorOutlineIcon />
              <Typography>
                This plugin was specified as a runtime plugin in your
                configuration file. Runtime plugins cannot be removed unless you
                are using the admin server. You can either manually remove the
                plugin from your configuration file or learn more about using
                the admin server{' '}
                <Link
                  href="https://jbrowse.org/jb2/docs/quickstart_gui#starting-jbrowse-2-admin-server"
                  target="_blank"
                  rel="noopener"
                >
                  here
                </Link>
                .
              </Typography>
            </>
          )}
        </div>
      </Dialog>
    </>
  )
}

export default observer(InstalledPlugin)
