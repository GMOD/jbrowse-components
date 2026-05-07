import { ConfirmDialog } from '@jbrowse/core/ui'
import { DialogContentText, List, ListItem } from '@mui/material'
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
    <ConfirmDialog
      open
      maxWidth="lg"
      title={`Close connection "${name}"`}
      submitText="Close connection"
      onCancel={onClose}
      onSubmit={() => {
        safelyBreakConnection?.()
        onClose()
      }}
    >
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
    </ConfirmDialog>
  )
})

export default CloseConnectionDialog
