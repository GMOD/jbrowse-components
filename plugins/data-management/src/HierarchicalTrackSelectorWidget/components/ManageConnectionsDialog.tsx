import React from 'react'
import Button from '@mui/material/Button'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import Dialog from '@jbrowse/core/ui/Dialog'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import {
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'
import { AbstractSessionModel } from '@jbrowse/core/util'

// icons
import CloseIcon from '@mui/icons-material/Close'

const useStyles = makeStyles()(theme => ({
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
