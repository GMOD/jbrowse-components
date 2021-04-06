import React from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
} from '@material-ui/core'
import CloseIcon from '@material-ui/icons/Close'
import { observer } from 'mobx-react'
import { readConfObject } from '@jbrowse/core/configuration'
import { AbstractSessionModel } from '@jbrowse/core/util'

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
    return (
      <Dialog open onClose={handleClose}>
        <DialogTitle>Manage connections</DialogTitle>
        <DialogContent>
          {session.connections.map((conf, idx) => {
            const name = readConfObject(conf, 'name')
            return (
              <div key={`${name}-${idx}`}>
                <IconButton
                  onClick={() => {
                    breakConnection(conf)
                    session.deleteConnection(conf)
                  }}
                >
                  <CloseIcon />
                </IconButton>
                {name}
              </div>
            )
          })}
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
