import React from 'react'
import Button from '@material-ui/core/Button'
import { makeStyles } from '@material-ui/core/styles'
import Dialog from '@material-ui/core/Dialog'
import DialogContent from '@material-ui/core/DialogContent'
import DialogContentText from '@material-ui/core/DialogContentText'
import DialogTitle from '@material-ui/core/DialogTitle'
import Divider from '@material-ui/core/Divider'
import WarningIcon from '@material-ui/icons/Warning'
import shortid from 'shortid'
import { Instance, IAnyStateTreeNode } from 'mobx-state-tree'
import { PluginDefinition } from '@jbrowse/core/PluginLoader'
import { SessionLoader } from './Loader'

const useStyles = makeStyles(theme => ({
  main: {
    textAlign: 'center',
    margin: theme.spacing(2),
    padding: theme.spacing(2),
    borderWidth: 2,
    borderRadius: 2,
  },
  buttons: {
    margin: theme.spacing(2),
    color: theme.palette.text.primary,
  },
}))

export default function SessionWarningModal({
  loader,
  sessionTriaged,
}: {
  loader: Instance<SessionLoader>
  sessionTriaged: { snap: IAnyStateTreeNode; origin: string }
}) {
  const classes = useStyles()

  const session = JSON.parse(JSON.stringify(sessionTriaged.snap))

  const handleClose = () => {
    loader.setSessionTriaged(undefined)
  }
  return (
    <Dialog
      open
      maxWidth="xl"
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
      data-testid="session-warning-modal"
      className={classes.main}
    >
      <DialogTitle id="alert-dialog-title">Warning</DialogTitle>
      <Divider />
      <div>
        <WarningIcon fontSize="large" />
        <DialogContent>
          <DialogContentText>
            External sessions can contain code that runs.
          </DialogContentText>
          <DialogContentText>
            Please ensure and confirm you trust the source of this session.
          </DialogContentText>
        </DialogContent>
        <div className={classes.buttons}>
          <Button
            color="primary"
            variant="contained"
            style={{ marginRight: 5 }}
            onClick={async () => {
              if (sessionTriaged.origin === 'config') {
                await loader.fetchPlugins(
                  session as { plugins: PluginDefinition[] },
                )
                loader.setConfigSnapshot({
                  ...session,
                  id: shortid(),
                })
              } else {
                loader.setSessionSnapshot({
                  ...session,
                  id: shortid(),
                })
              }
              handleClose()
            }}
          >
            Confirm
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              // skips fetch plugins so externals are never loaded
              /// need to figure out flow for when load external like msa -> open an msa view -> refresh -> reject loading. currently crashes
              if (sessionTriaged.origin === 'config')
                loader.setConfigSnapshot({
                  ...session, // ask if this should still be session or something else
                  id: shortid(),
                })
              loader.setBlankSession(true)
              handleClose()
            }}
          >
            Cancel
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
