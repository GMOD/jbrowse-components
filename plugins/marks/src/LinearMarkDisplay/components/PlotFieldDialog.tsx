import { useState } from 'react'

import {
  ErrorBanner,
  LabeledCheckbox,
  LoadingEllipses,
  SubmitDialog,
} from '@jbrowse/core/ui'
import { TextField, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { MARK_SHAPE_CHOICES } from '../plotFields.ts'

import type { PlotFields, PlotShape, PlotSpec } from '../plotFields.ts'

export interface PlotFieldDialogModel {
  plotFields: PlotFields | undefined
  plotFieldsError: unknown
  plotSpec: PlotSpec
  setPlotMarks: (spec: PlotSpec) => void
}

const NONE = ''

const PlotFieldDialog = observer(function PlotFieldDialog({
  model,
  handleClose,
}: {
  model: PlotFieldDialogModel
  handleClose: () => void
}) {
  const { plotFields, plotFieldsError } = model
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
      submitDisabled={spec.field === ''}
      onCancel={handleClose}
      onSubmit={() => {
        model.setPlotMarks(spec)
        handleClose()
      }}
    >
      <Typography color="text.secondary">
        Draws one mark per feature at the value of the field you pick.
      </Typography>
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
            ? 'The features here carry no numeric field'
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
        label="Shape"
        value={spec.shape}
        onChange={event => {
          update({ shape: event.target.value as PlotShape })
        }}
        slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
      >
        {MARK_SHAPE_CHOICES.map(s => (
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
