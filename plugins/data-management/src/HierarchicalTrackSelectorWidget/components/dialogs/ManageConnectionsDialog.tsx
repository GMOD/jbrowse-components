import React from 'react'
import { readConfObject } from '@jbrowse/core/configuration'
import { Dialog } from '@jbrowse/core/ui'

// icons
import CloseIcon from '@mui/icons-material/Close'
import {
  Button,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { AbstractSessionModel } from '@jbrowse/core/util'

const useStyles = makeStyles()(theme => ({
  connectionContainer: {
    margin: theme.spacing(4),
    width: 500,
  },
}))

function DisabledButton() {
  return (
    <Tooltip title="Unable to delete connection in config file as non-admin user">
      <IconButton>
        <CloseIcon color="disabled" />
      </IconButton>
    </Tooltip>
  )
}

const ManageConnectionsDialog = observer(function ({
  session,
  handleClose,
  breakConnection,
}: {
  handleClose: () => void
  session: AbstractSessionModel
  breakConnection: (conf: AnyConfigurationModel, arg: boolean) => void
}) {
  const { classes } = useStyles()
  const { adminMode, connections, sessionConnections } = session
  return (
    <Dialog open onClose={handleClose} maxWidth="lg" title="Delete connections">
      <DialogContent>
        <Typography>
          Click the X icon to delete the connection from your config completely
        </Typography>
        <div className={classes.connectionContainer}>
          {connections.map(conf => {
            const name = readConfObject(conf, 'name')
            return (
              <Typography key={`conn-${name}`}>
                {adminMode || sessionConnections?.includes(conf) ? (
                  <IconButton
                    onClick={() => {
                      breakConnection(conf, true)
                    }}
                  >
                    <CloseIcon color="error" />
                  </IconButton>
                ) : (
                  <DisabledButton />
                )}
                {name}
              </Typography>
            )
          })}
          {!connections.length ? (
            <Typography>No connections found</Typography>
          ) : null}
        </div>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            handleClose()
          }}
          variant="contained"
          color="primary"
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
})

export default ManageConnectionsDialog
