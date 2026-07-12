import { useState } from 'react'

import {
  Checkbox,
  FormControlLabel,
  FormGroup,
  Typography,
} from '@mui/material'

import SubmitDialog from './SubmitDialog.tsx'
import {
  applyPromotableDefault,
  isPromotableDefault,
  tracksDifferingFrom,
} from '../configuration/promotableDefaults.ts'

import type {
  PromotableDisplay,
  PromotableEntry,
} from '../configuration/promotableDefaults.ts'

// The manage-default form behind a promotable setting's trailing adornment. Two
// independent choices, applied on submit: "future tracks" sets (or clears) the
// session-wide default; "currently open tracks" also updates the open tracks that
// differ. Staged (local state, nothing changes until submit) so the dialog has no
// surprising live behavior, and the open-tracks option names its count so the
// overwrite scope is visible before it happens.
function PromotableDefaultDialog({
  self,
  entries,
  valueLabel,
  handleClose,
}: {
  self: PromotableDisplay
  entries: PromotableEntry[]
  valueLabel: string
  handleClose: () => void
}) {
  const [future, setFuture] = useState(() => isPromotableDefault(self, entries))
  const [openTracks, setOpenTracks] = useState(false)
  const differingCount = tracksDifferingFrom(self, entries).length
  return (
    <SubmitDialog
      open
      title={`Default: ${valueLabel}`}
      onCancel={() => {
        handleClose()
      }}
      onSubmit={() => {
        applyPromotableDefault(self, entries, { future, openTracks })
        handleClose()
      }}
    >
      <Typography>
        Use "{valueLabel}" as the default for tracks of this type.
      </Typography>
      <FormGroup>
        <FormControlLabel
          control={
            <Checkbox
              checked={future}
              onChange={event => {
                setFuture(event.target.checked)
              }}
            />
          }
          label="Apply to future tracks (new tracks of this type)"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={openTracks}
              disabled={differingCount === 0}
              onChange={event => {
                setOpenTracks(event.target.checked)
              }}
            />
          }
          label={
            differingCount === 0
              ? 'Currently open tracks already match'
              : `Apply to ${differingCount} currently open track${differingCount === 1 ? '' : 's'}`
          }
        />
      </FormGroup>
    </SubmitDialog>
  )
}

export default PromotableDefaultDialog
