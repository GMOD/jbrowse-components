import React from 'react'
import {
  Button,
  Checkbox,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Typography,
} from '@mui/material'
import { Dialog } from '@jbrowse/core/ui'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import {
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'
import { AbstractSessionModel } from '@jbrowse/core/util'

export function ellipses(slug: string) {
  return slug.length > 20 ? `${slug.slice(0, 20)}...` : slug
}

const useStyles = makeStyles()(theme => ({
  connectionContainer: {
    width: 500,
    margin: theme.spacing(4),
  },
}))

function ToggleConnectionDialog({
  session,
  handleClose,
  breakConnection,
}: {
  handleClose: () => void
  session: AbstractSessionModel
  breakConnection: (arg: AnyConfigurationModel) => void
}) {
  const { classes } = useStyles()
  const { connections, connectionInstances: instances = [] } = session
  return (
    <Dialog
      open
      onClose={handleClose}
      maxWidth="lg"
      title="Turn on/off connections"
    >
      <DialogContent>
        <Typography>Use the checkbox to turn on/off connections</Typography>
        <div className={classes.connectionContainer}>
          {connections.map(conf => {
            const name = readConfObject(conf, 'name')
            const assemblyNames = readConfObject(conf, 'assemblyNames')
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
                label={`${name} ${
                  assemblyNames.length
                    ? '(' + ellipses(assemblyNames.join(',')) + ')'
                    : ''
                }`}
              />
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

export default observer(ToggleConnectionDialog)
