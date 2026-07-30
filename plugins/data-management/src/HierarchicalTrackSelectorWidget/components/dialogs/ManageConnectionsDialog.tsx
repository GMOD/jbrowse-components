import { readConfObject } from '@jbrowse/core/configuration'
import { InfoDialog } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import CloseIcon from '@mui/icons-material/Close'
import { IconButton, Tooltip, Typography } from '@mui/material'
import { observer } from 'mobx-react'

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

const ManageConnectionsDialog = observer(function ManageConnectionsDialog({
  session,
  handleClose,
  onDelete,
}: {
  handleClose: () => void
  session: AbstractSessionModel
  onDelete: (conf: AnyConfigurationModel) => void
}) {
  const { classes } = useStyles()
  const { adminMode, connections, sessionConnections } = session
  return (
    <InfoDialog
      open
      onClose={handleClose}
      maxWidth="lg"
      title="Manage connections"
    >
      <Typography>
        Click the X icon to delete the connection from your config completely
      </Typography>
      <div className={classes.connectionContainer}>
        {connections.map(conf => {
          const name = readConfObject(conf, 'name')
          return (
            <Typography key={conf.connectionId}>
              {adminMode || sessionConnections?.includes(conf) ? (
                <IconButton
                  onClick={() => {
                    onDelete(conf)
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
    </InfoDialog>
  )
})

export default ManageConnectionsDialog
