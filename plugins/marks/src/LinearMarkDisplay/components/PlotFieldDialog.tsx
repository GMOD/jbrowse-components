import { useState } from 'react'

import {
  ErrorBanner,
  LabeledCheckbox,
  LoadingEllipses,
  SubmitDialog,
} from '@jbrowse/core/ui'
import { pluralize } from '@jbrowse/core/util'
import { Alert, Button, TextField, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { MARK_TYPE_CHOICES } from '../plotFields.ts'

import type { PlotMark, PlotSpec } from '../plotFields.ts'
import type { PlotFields } from '../scanPlotFields.ts'

export interface PlotFieldDialogModel {
  plotFields: PlotFields | undefined
  plotFieldsError: unknown
  plotSpec: PlotSpec
  /** How many declared marks a save would replace rather than edit. */
  plotSpecReplaces: number
  /** The window the field scan read. */
  plotScanLocus: string | undefined
  setPlotMarks: (spec: PlotSpec) => void
  /** Where a config this form cannot read is edited instead of replaced. */
  openMarkPlotDialog: () => void
}

const NONE = ''

const PlotFieldDialog = observer(function PlotFieldDialog({
  model,
  handleClose,
}: {
  model: PlotFieldDialogModel
  handleClose: () => void
}) {
  const { plotFields, plotFieldsError, plotSpecReplaces } = model
  const [spec, setSpec] = useState(model.plotSpec)
  const colorChoices = plotFields
    ? [...plotFields.numeric, ...plotFields.categorical].sort()
    : []
  const fieldChoices = plotFields?.numeric ?? []
  const update = (patch: Partial<PlotSpec>) => {
    setSpec(prev => ({ ...prev, ...patch }))
  }

  return (
    <SubmitDialog
      open
      title="Plot a field"
      submitText="Apply"
      submitDisabled={spec.field === '' || plotSpecReplaces > 0}
      onCancel={handleClose}
      onSubmit={() => {
        model.setPlotMarks(spec)
        handleClose()
      }}
      actions={
        <Button
          onClick={() => {
            model.openMarkPlotDialog()
            handleClose()
          }}
        >
          Edit plot...
        </Button>
      }
    >
      <Typography color="text.secondary">
        Draws one mark per feature at the value of the field you pick.
      </Typography>
      {plotSpecReplaces > 0 ? (
        <Alert severity="warning">
          This track declares {plotSpecReplaces}{' '}
          {pluralize(plotSpecReplaces, 'mark')} saying more than this dialog can
          read. Edit plot... holds {plotSpecReplaces > 1 ? 'them all' : 'it'}.
        </Alert>
      ) : null}
      {plotFieldsError ? <ErrorBanner error={plotFieldsError} /> : null}
      {!plotFields && !plotFieldsError ? (
        <LoadingEllipses message="Scanning features for fields" />
      ) : null}
      <TextField
        select
        fullWidth
        label="Value field"
        value={spec.field}
        helperText={
          plotFields && fieldChoices.length === 0
            ? model.plotScanLocus
              ? `No feature in ${model.plotScanLocus} carries a numeric field; reopen over others to scan them`
              : 'Nothing on screen to scan for fields'
            : undefined
        }
        onChange={event => {
          update({ field: event.target.value })
        }}
        slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
      >
        <option value={NONE} disabled />
        {fieldChoices.map(f => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
      </TextField>
      <TextField
        select
        fullWidth
        label="Mark"
        value={spec.mark}
        onChange={event => {
          update({ mark: event.target.value as PlotMark })
        }}
        slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
      >
        {MARK_TYPE_CHOICES.map(s => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </TextField>
      <TextField
        select
        fullWidth
        label="Color by"
        value={spec.colorField}
        helperText="A text field gets a palette, a numeric one a ramp"
        onChange={event => {
          update({ colorField: event.target.value })
        }}
        slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
      >
        <option value={NONE}>None</option>
        {colorChoices.map(f => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
      </TextField>
      <div>
        <LabeledCheckbox
          checked={spec.binned}
          onChange={binned => {
            update({ binned })
          }}
          label="Count per bin zoomed out"
        />
      </div>
    </SubmitDialog>
  )
})

export default PlotFieldDialog
