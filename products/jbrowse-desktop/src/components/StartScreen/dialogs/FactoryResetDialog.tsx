import { ErrorMessage } from '@jbrowse/core/ui'
import ConfirmDialog from '@jbrowse/core/ui/ConfirmDialog'
import { DialogContentText } from '@mui/material'
import { observer } from 'mobx-react'

import factoryReset from '../../factoryReset.ts'
import { useIpcAction } from './useIpcAction.ts'

const FactoryResetDialog = observer(function FactoryResetDialog({
  onClose,
}: {
  onClose: () => void
}) {
  const { error, pending, onSubmit } = useIpcAction(factoryReset, onClose)
  return (
    <ConfirmDialog
      open
      maxWidth="sm"
      title="Factory reset?"
      submitText="Reset"
      submitDisabled={pending}
      onSubmit={onSubmit}
      onCancel={onClose}
    >
      <DialogContentText>
        This deletes your autosaved sessions, empties the recently opened
        sessions list and removes your global plugins.
      </DialogContentText>
      <DialogContentText>
        It also deletes the .fai indexes JBrowse made for FASTA files that had
        none, and the search indexes it built. Session files you saved yourself
        and your Quickstart list are kept, but one that used such a .fai no
        longer loads its genome, and a track's search index has to be rebuilt.
      </DialogContentText>
      <DialogContentText>This action cannot be undone</DialogContentText>
      {error ? <ErrorMessage error={error} /> : null}
    </ConfirmDialog>
  )
})

export default FactoryResetDialog
