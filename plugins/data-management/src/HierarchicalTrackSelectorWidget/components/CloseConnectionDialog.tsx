import React from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  Button,
  List,
  ListItem,
  DialogActions,
} from '@material-ui/core'
import { observer } from 'mobx-react'

function CloseConnectionDialog({
  modalInfo = {},
  setModalInfo,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  modalInfo: any
  setModalInfo: Function
}) {
  const { name, dereferenceTypeCount, safelyBreakConnection } = modalInfo
  return (
    <Dialog open>
      <DialogTitle>Close connection &quot;{name}&quot;</DialogTitle>
      <DialogContent>
        {dereferenceTypeCount ? (
          <>
            <DialogContentText>
              Closing this connection will close:
            </DialogContentText>
            <List>
              {Object.entries(dereferenceTypeCount).map(([key, value]) => (
                <ListItem key={key}>{`${value} ${key}`}</ListItem>
              ))}
            </List>
          </>
        ) : null}
        <DialogContentText>
          Are you sure you want to close this connection?
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
                  if (safelyBreakConnection) {
                    safelyBreakConnection()
                  }
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
}

export default observer(CloseConnectionDialog)
