import { Dialog } from '@jbrowse/core/ui'
import {
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
  List,
  ListItem,
} from '@mui/material'
import { observer } from 'mobx-react'

const CloseConnectionDialog = observer(function CloseConnectionDialog({
  modalInfo = {},
  onClose,
}: {
  modalInfo?: {
    name?: string
    dereferenceTypeCount?: Record<string, number>
    safelyBreakConnection?: () => void
  }
  onClose: () => void
}) {
  const { name, dereferenceTypeCount, safelyBreakConnection } = modalInfo
  return (
    <Dialog
      open
      maxWidth="lg"
      title={`Close connection "${name}"`}
      onClose={onClose}
    >
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
            onClose()
          }}
          color="primary"
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => {
            safelyBreakConnection?.()
            onClose()
          }}
          color="primary"
        >
          OK
        </Button>
      </DialogActions>
    </Dialog>
  )
})

export default CloseConnectionDialog
