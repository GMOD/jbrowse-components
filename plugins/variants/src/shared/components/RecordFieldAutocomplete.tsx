import { useFetch } from '@jbrowse/core/util/useFetch'
import { Autocomplete, TextField, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { variantFilterFields } from '../variantFilterFields.ts'
import { fieldRefOf } from './cellColorFieldDialogUtil.ts'

import type { JexlFilterField } from '@jbrowse/core/ui/JexlFilterDialog'

export interface RecordFieldChoice {
  ref: string
  label: string
  group?: string
  description?: string
  numeric: boolean
  call?: string
}

function choicesOf(fields: JexlFilterField[]): RecordFieldChoice[] {
  return fields.map(f => ({
    ref: fieldRefOf(f),
    label: f.label,
    group: f.group,
    description: f.description,
    numeric: f.type === 'number',
    call: 'call' in f ? f.call : undefined,
  }))
}

/** The record fields a VCF's header declares, as a field picker offers them. */
export function useRecordFieldChoices(model: {
  id: string
  fetchAdapterMetadata: () => Promise<unknown>
}) {
  const { data } = useFetch(
    ['variantRecordFields', model.id] as const,
    async () =>
      choicesOf(await variantFilterFields(model.fetchAdapterMetadata())),
  )
  return data ?? []
}

/**
 * A free-text field ref with the header's fields to pick from, an INFO field
 * written as its dotted path.
 */
export const RecordFieldAutocomplete = observer(
  function RecordFieldAutocomplete({
    choices,
    value,
    onChange,
    helperText,
    testId,
  }: {
    choices: RecordFieldChoice[]
    value: string
    onChange: (value: string) => void
    helperText?: string
    testId: string
  }) {
    return (
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
        inputValue={value}
        onInputChange={(_event, next) => {
          onChange(next)
        }}
        renderInput={({ slotProps, ...params }) => (
          <TextField
            {...params}
            label="Field"
            placeholder="e.g. INFO.CLNSIG"
            helperText={helperText}
            autoFocus
            fullWidth
            slotProps={{
              ...slotProps,
              htmlInput: {
                ...slotProps.htmlInput,
                'data-testid': testId,
              },
            }}
          />
        )}
      />
    )
  },
)
