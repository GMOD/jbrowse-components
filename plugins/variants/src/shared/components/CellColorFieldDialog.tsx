import { useState } from 'react'

import { SubmitDialog } from '@jbrowse/core/ui'
import { SV_TYPE_FIELD } from '@jbrowse/core/util/categoricalField'
import { TextField, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { IMPACT_FIELD } from '../variantConsequence.ts'
import {
  RecordFieldAutocomplete,
  useRecordFieldChoices,
} from './RecordFieldAutocomplete.tsx'
import { cellColorOfField, parseCuts } from './cellColorFieldDialogUtil.ts'

import type { Plot } from '@jbrowse/core/configuration'
import type { ColorSlots } from '@jbrowse/core/util/colorScale'

const CellColorFieldDialog = observer(function CellColorFieldDialog({
  model,
  handleClose,
}: {
  model: {
    id: string
    colorField: string
    colorSetting: {
      scale: { type: string | undefined; domain: readonly string[] }
    }
    writtenColor: ColorSlots
    parkedColor?: ColorSlots
    parkColor: (name: string, written: ColorSlots, next: unknown) => void
    fetchAdapterMetadata: () => Promise<unknown>
    applyPlot: (draft: Plot) => void
  }
  handleClose: () => void
}) {
  // impact and SV type are the Color by menu's own rows
  const choices = useRecordFieldChoices(model).filter(
    c => c.call !== IMPACT_FIELD && c.call !== SV_TYPE_FIELD,
  )
  const current = model.colorSetting
  const [ref, setRef] = useState(model.colorField)
  const [cuts, setCuts] = useState(
    current.scale.type === 'threshold' ? current.scale.domain.join(', ') : '',
  )
  const trimmed = ref.trim()
  const chosen = choices.find(c => c.ref === trimmed)
  const parsed = parseCuts(cuts)

  return (
    <SubmitDialog
      open
      title="Color cells by field"
      submitText="Apply"
      submitDisabled={!trimmed || parsed === undefined}
      onCancel={() => {
        handleClose()
      }}
      onSubmit={() => {
        const color = cellColorOfField(
          model.writtenColor,
          trimmed,
          parsed ?? [],
          model.parkedColor,
        )
        model.parkColor('color', model.writtenColor, color)
        model.applyPlot({ encoding: { color } })
        handleClose()
      }}
    >
      <Typography variant="body2" gutterBottom>
        Each value of the field gives the variant&apos;s alt cells one palette
        color, with a key. Cut points turn a number into ranges instead.
      </Typography>
      <RecordFieldAutocomplete
        choices={choices}
        value={ref}
        onChange={value => {
          setRef(value)
        }}
        helperText={chosen?.description}
        testId="cell-color-field"
      />
      <TextField
        fullWidth
        margin="normal"
        label="Cut points (optional)"
        placeholder={chosen?.numeric ? 'e.g. 0.001, 0.01, 0.05' : undefined}
        value={cuts}
        error={parsed === undefined}
        helperText={
          parsed === undefined
            ? 'Numbers separated by commas'
            : parsed.length
              ? `${parsed.length + 1} ranges`
              : 'Blank gives each value its own color'
        }
        onChange={event => {
          setCuts(event.target.value)
        }}
        slotProps={{ htmlInput: { 'data-testid': 'cell-color-cuts' } }}
      />
    </SubmitDialog>
  )
})

export default CellColorFieldDialog
