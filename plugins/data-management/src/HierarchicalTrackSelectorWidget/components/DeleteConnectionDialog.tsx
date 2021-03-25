import React from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  List,
  ListItem,
  Button,
} from '@material-ui/core'
import { observer } from 'mobx-react'

export default observer(
  ({
    open,
    modalInfo = {},
    session,
    setModalInfo,
  }: {
    open: boolean
    modalInfo: any
    session: any
    setModalInfo: Function
  }) => {
    const {
      connectionConf,
      name,
      dereferenceTypeCount,
      safelyBreakConnection,
    } = modalInfo
    return (
      <Dialog
        aria-labelledby="connection-modal-title"
        aria-describedby="connection-modal-description"
        open={open}
      >
        <DialogTitle>Delete connection &quot;{name}&quot;</DialogTitle>
        <DialogContent>
          {dereferenceTypeCount ? (
            <>
              Closing this connection will close
              <List>
                {Object.entries(dereferenceTypeCount).map(([key, value]) => (
                  <ListItem key={key}>{`${value} ${key}`}</ListItem>
                ))}
              </List>
            </>
          ) : null}
          <DialogContentText>
            Are you sure you want to delete this connection?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setModalInfo()
            }}
            color="primary"
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={
              modalInfo
                ? () => {
                    if (safelyBreakConnection) safelyBreakConnection()
                    session.deleteConnection(connectionConf)
                    setModalInfo()
                  }
                : () => {}
            }
            color="primary"
          >
            OK
          </Button>
        </DialogActions>
      </Dialog>
    )
  },
)
