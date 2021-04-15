import React from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControlLabel,
  Checkbox,
  IconButton,
  Typography,
  makeStyles,
} from '@material-ui/core'
import CloseIcon from '@material-ui/icons/Close'
import { observer } from 'mobx-react'
import { readConfObject } from '@jbrowse/core/configuration'
import { AbstractSessionModel } from '@jbrowse/core/util'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'

const useStyles = makeStyles(theme => ({
  closeButton: {
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
    color: theme.palette.grey[500],
  },

  connectionContainer: {
    width: 500,
    margin: theme.spacing(4),
  },
}))

export default observer(
  ({
    session,
    handleClose,
    breakConnection,
  }: {
    handleClose: () => void
    session: AbstractSessionModel
    breakConnection: Function
  }) => {
    const classes = useStyles()
    const { connections, connectionInstances } = session

    function handleConnectionToggle(connectionConf: AnyConfigurationModel) {
      const existingConnection = !!connectionInstances?.find(
        conn => conn.name === readConfObject(connectionConf, 'name'),
      )
      if (existingConnection) {
        breakConnection(connectionConf)
      } else {
        session.makeConnection?.(connectionConf)
      }
    }
    return (
      <Dialog open onClose={handleClose} maxWidth="lg">
        <DialogTitle>
          Manage connections
          <IconButton
            className={classes.closeButton}
            onClick={() => handleClose()}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography>Use the checkbox to turn on/off connections</Typography>
          <div className={classes.connectionContainer}>
            {connections.map(conf => {
              const name = readConfObject(conf, 'name')
              return (
                <div>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={
                          !!connectionInstances?.find(
                            conn => name === conn.name,
                          )
                        }
                        onChange={() => handleConnectionToggle(conf)}
                        color="primary"
                      />
                    }
                    label={name}
                  />
                </div>
              )
            })}
            {!connections.length ? 'No connections found' : null}
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
  },
)
