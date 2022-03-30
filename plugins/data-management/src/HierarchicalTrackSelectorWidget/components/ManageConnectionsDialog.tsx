import React from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Tooltip,
  Typography,
  makeStyles,
} from '@material-ui/core'
import CloseIcon from '@material-ui/icons/Close'
import { observer } from 'mobx-react'
import { readConfObject } from '@jbrowse/core/configuration'
import { AbstractSessionModel } from '@jbrowse/core/util'

const useStyles = makeStyles(theme => ({
  closeButton: {
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
    color: theme.palette.grey[500],
  },

  connectionContainer: {
    margin: theme.spacing(4),
    width: 500,
  },
}))

function ManageConnectionsDlg({
  session,
  handleClose,
  breakConnection,
}: {
  handleClose: () => void
  session: AbstractSessionModel
  breakConnection: Function
}) {
  const classes = useStyles()
  const { adminMode, connections, sessionConnections } = session
  return (
    <Dialog open onClose={handleClose} maxWidth="lg">
      <DialogTitle>
        Delete connections
        <IconButton
          className={classes.closeButton}
          onClick={() => handleClose()}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Typography>
          Click the X icon to delete the connection from your config completely
        </Typography>
        <div className={classes.connectionContainer}>
          {connections.map(conf => {
            const name = readConfObject(conf, 'name')
            return (
              <div key={`conn-${name}`}>
                <Typography>
                  {adminMode || sessionConnections?.includes(conf) ? (
                    <IconButton onClick={() => breakConnection(conf, true)}>
                      <CloseIcon color="error" />
                    </IconButton>
                  ) : (
                    <Tooltip title="Unable to delete connection in config file as non-admin user">
                      <IconButton>
                        <CloseIcon color="disabled" />
                      </IconButton>
                    </Tooltip>
                  )}
                  {name}
                </Typography>
              </div>
            )
          })}
          {!connections.length ? (
            <Typography>No connections found</Typography>
          ) : null}
        </div>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => handleClose()}
          variant="contained"
          color="primary"
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default observer(ManageConnectionsDlg)
