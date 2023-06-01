import React from 'react'
import {
  DialogContent,
  DialogContentText,
  Button,
  List,
  ListItem,
  DialogActions,
} from '@mui/material'
import { Dialog } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

export default observer(function CloseConnectionDialog({
  modalInfo = {},
  onClose,
}: {
  modalInfo?: {
    name?: string
    dereferenceTypeCount?: { [key: string]: number }
    safelyBreakConnection?: () => void
  }
  onClose: () => void
}) {
  const { name, dereferenceTypeCount, safelyBreakConnection } = modalInfo
  return (
    <Dialog open maxWidth="lg" title={`Close connection "${name}"`}>
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
        <Button onClick={() => onClose()} color="primary">
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={
            modalInfo
              ? () => {
                  safelyBreakConnection?.()
                  onClose()
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
})
