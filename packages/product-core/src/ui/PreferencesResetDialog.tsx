import { SettingsChangesTable, SubmitDialog } from '@jbrowse/core/ui'
import { DialogContentText, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { TrackConfigChange } from '@jbrowse/core/util'

// Confirmation shown before "Reset to defaults" wipes every customized
// preference. Lists exactly what will change as a Setting/Default/Current diff
// (the same table the per-track reset uses) so the reset is never a blind
// action. A standard modal — focus-trapped, Enter to confirm, Escape to cancel
// — replaces the former label-swapping two-click button, which screen readers
// and keyboard users could not follow.
const PreferencesResetDialog = observer(function PreferencesResetDialog({
  changes,
  onReset,
  onResetRow,
  onClose,
}: {
  changes: TrackConfigChange[]
  onReset: () => void
  onResetRow: (change: TrackConfigChange) => void
  onClose: () => void
}) {
  return (
    <SubmitDialog
      open
      title="Reset preferences to defaults"
      maxWidth="md"
      submitText="Reset to defaults"
      submitDisabled={changes.length === 0}
      cancelText="Cancel"
      onCancel={() => {
        onClose()
      }}
      onSubmit={() => {
        onReset()
        onClose()
      }}
    >
      {changes.length ? (
        <>
          <DialogContentText>
            These preferences differ from their defaults. Reset an individual
            entry with its revert button, or reset them all below:
          </DialogContentText>
          <SettingsChangesTable changes={changes} onResetRow={onResetRow} />
        </>
      ) : (
        <Typography>All preferences are already at their defaults.</Typography>
      )}
    </SubmitDialog>
  )
})

export default PreferencesResetDialog
