import { useState } from 'react'

import { FileSelector } from '@jbrowse/core/ui'
import SubmitDialog from '@jbrowse/core/ui/SubmitDialog'
import {
  isBlobLocation,
  isFileHandleLocation,
  isLocalPathLocation,
  isUriLocation,
} from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Button } from '@mui/material'
import { observer } from 'mobx-react'

import type { SlotFacade } from '@jbrowse/core/configuration'
import type { FileLocation } from '@jbrowse/core/util'

const useStyles = makeStyles()(theme => ({
  files: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
}))

function storedLocation(value: unknown) {
  return isUriLocation(value) ||
    isLocalPathLocation(value) ||
    isBlobLocation(value) ||
    isFileHandleLocation(value)
    ? value
    : undefined
}

/**
 * The error bar's file fix: each file location of a failing track's adapter,
 * as the settings form draws it, written back on Save. "All settings..."
 * opens the whole form for anything else.
 */
const TrackFilesDialog = observer(function TrackFilesDialog({
  trackName,
  slots,
  onSave,
  onAllSettings,
  handleClose,
}: {
  trackName: string
  slots: { label: string; slot: SlotFacade }[]
  onSave: () => void
  onAllSettings: () => void
  handleClose: () => void
}) {
  const { classes } = useStyles()
  const [edits, setEdits] = useState<Record<string, FileLocation>>({})
  return (
    <SubmitDialog
      open
      maxWidth="md"
      fullWidth
      title={`Files of ${trackName}`}
      data-testid="track_files_dialog"
      submitText="Save"
      submitDisabled={Object.keys(edits).length === 0}
      onCancel={handleClose}
      onSubmit={() => {
        for (const { label, slot } of slots) {
          const edit = edits[label]
          if (edit) {
            slot.set(edit)
          }
        }
        onSave()
        handleClose()
      }}
      actions={
        <Button
          onClick={() => {
            onAllSettings()
            handleClose()
          }}
        >
          All settings...
        </Button>
      }
    >
      <div className={classes.files}>
        {slots.map(({ label, slot }) => (
          <div key={label}>
            <FileSelector
              name={label}
              description={slot.description}
              location={edits[label] ?? storedLocation(slot.value)}
              setLocation={location => {
                setEdits(prev => ({ ...prev, [label]: location }))
              }}
              rootModel={slot.pluginManager.rootModel}
            />
          </div>
        ))}
      </div>
    </SubmitDialog>
  )
})

export default TrackFilesDialog
