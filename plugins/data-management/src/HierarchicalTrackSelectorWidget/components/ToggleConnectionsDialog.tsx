import React from 'react'
import {
  Button,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  IconButton,
  Typography,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import CloseIcon from '@mui/icons-material/Close'
import { observer } from 'mobx-react'
import {
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'
import { AbstractSessionModel } from '@jbrowse/core/util'

const useStyles = makeStyles()(theme => ({
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

function ToggleConnectionDialog({
  session,
  handleClose,
  assemblyName,
  breakConnection,
}: {
  handleClose: () => void
  session: AbstractSessionModel
  assemblyName: string
  breakConnection: (arg: AnyConfigurationModel) => void
}) {
  const { classes } = useStyles()
  const { connections, connectionInstances: instances = [] } = session
  const assemblySpecificConnections = connections.filter(c => {
    const configAssemblyNames = readConfObject(c, 'assemblyNames')
    if (configAssemblyNames.length === 0) {
      return true
    }
    return configAssemblyNames.includes(assemblyName)
  })

  return (
    <Dialog open onClose={handleClose} maxWidth="lg">
      <DialogTitle>
        Turn on/off connections
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
          {assemblySpecificConnections.map(conf => {
            const name = readConfObject(conf, 'name')
            const found = instances.find(conn => name === conn.name)
            return (
              <FormControlLabel
                key={conf.connectionId}
                control={
                  <Checkbox
                    checked={!!found}
                    onChange={() => {
                      if (found) {
                        breakConnection(conf)
                      } else {
                        session.makeConnection?.(conf)
                      }
                    }}
                    color="primary"
                  />
                }
                label={name}
              />
            )
          })}
          {!assemblySpecificConnections.length ? (
            <Typography>No connections found for {assemblyName}</Typography>
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

export default observer(ToggleConnectionDialog)
