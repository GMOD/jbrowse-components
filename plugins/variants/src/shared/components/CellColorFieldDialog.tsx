import { useState } from 'react'

import { SubmitDialog } from '@jbrowse/core/ui'
import { useFetch } from '@jbrowse/core/util/useFetch'
import { Autocomplete, TextField, Typography } from '@mui/material'

import { IMPACT_FIELD } from '../variantConsequence.ts'
import { variantFilterFields } from '../variantFilterFields.ts'
import { SV_TYPE_FIELD } from '../variantSvType.ts'
import {
  cellColorOfField,
  fieldRefOf,
  parseCuts,
} from './cellColorFieldDialogUtil.ts'

import type { JexlFilterField } from '@jbrowse/core/ui/JexlFilterDialog'

interface FieldChoice {
  ref: string
  label: string
  group?: string
  description?: string
  numeric: boolean
}

function choicesOf(fields: JexlFilterField[]): FieldChoice[] {
  return fields
    .filter(
      f =>
        !('call' in f) || (f.call !== IMPACT_FIELD && f.call !== SV_TYPE_FIELD),
    )
    .map(f => ({
      ref: fieldRefOf(f),
      label: f.label,
      group: f.group,
      description: f.description,
      numeric: f.type === 'number',
    }))
}

export default function CellColorFieldDialog({
  model,
  handleClose,
}: {
  model: {
    id: string
    colorField: string
    colorSetting: { scale: string | undefined; domain: readonly string[] }
    fetchAdapterMetadata: () => Promise<unknown>
    setColor: (color: Record<string, unknown>) => void
  }
  handleClose: () => void
}) {
  const { data } = useFetch(
    ['variantCellColorFields', model.id] as const,
    async () =>
      choicesOf(await variantFilterFields(model.fetchAdapterMetadata())),
  )
  const choices = data ?? []
  const current = model.colorSetting
  const [ref, setRef] = useState(model.colorField)
  const [cuts, setCuts] = useState(
    current.scale === 'threshold' ? current.domain.join(', ') : '',
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
        model.setColor(cellColorOfField(trimmed, parsed ?? []))
        handleClose()
      }}
    >
      <Typography variant="body2" gutterBottom>
        Each value of the field gives the variant&apos;s alt cells one palette
        colour, with a key. Cut points turn a number into ranges instead.
      </Typography>
      <Autocomplete
        freeSolo
        options={choices}
        groupBy={c => c.group ?? ''}
        getOptionLabel={c => (typeof c === 'string' ? c : c.ref)}
        renderOption={({ key, ...props }, c) => (
          <li key={key} {...props}>
            <div>
              <Typography variant="body2">{c.label}</Typography>
              {c.description ? (
                <Typography variant="caption" color="textSecondary">
                  {c.description}
                </Typography>
              ) : null}
            </div>
          </li>
        )}
        inputValue={ref}
        onInputChange={(_event, value) => {
          setRef(value)
        }}
        renderInput={({ slotProps, ...params }) => (
          <TextField
            {...params}
            label="Field"
            placeholder="e.g. INFO.CLNSIG"
            helperText={chosen?.description}
            autoFocus
            fullWidth
            slotProps={{
              ...slotProps,
              htmlInput: {
                ...slotProps.htmlInput,
                'data-testid': 'cell-color-field',
              },
            }}
          />
        )}
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
              : 'Blank gives each value its own colour'
        }
        onChange={event => {
          setCuts(event.target.value)
        }}
        slotProps={{ htmlInput: { 'data-testid': 'cell-color-cuts' } }}
      />
    </SubmitDialog>
  )
}
