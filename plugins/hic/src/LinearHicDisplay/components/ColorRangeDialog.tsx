import { useState } from 'react'

import SubmitDialog from '@jbrowse/core/ui/SubmitDialog'
import { Button, FormHelperText, TextField, Typography } from '@mui/material'
import { observer } from 'mobx-react'

export interface ColorRangeHost {
  colorDomain: [number, number]
  colorDomainMin: number | undefined
  colorDomainMax: number | undefined
  colorQuantile: number
  setColorRange: (range: {
    min: number | undefined
    max: number | undefined
    quantile: number
  }) => void
  resetColorRange: () => void
}

// '' follows the counts; any other text that isn't a number is held back
// rather than read as empty, which would unpin the end.
function parse(text: string) {
  const trimmed = text.trim()
  return trimmed === '' ? undefined : Number(trimmed)
}

const fmt = (n: number) => `${Number(n.toPrecision(4))}`

function textOf(n: number | undefined) {
  return n === undefined ? '' : `${n}`
}

export function colorRangeProblem(
  min: number | undefined,
  max: number | undefined,
  percentile: number | undefined,
) {
  if (Number.isNaN(min) || Number.isNaN(max)) {
    return 'Enter a number, or leave the field empty to follow the counts'
  }
  if (min !== undefined && max !== undefined && !(max > min)) {
    return 'Max must be greater than min'
  }
  if (percentile === undefined || !(percentile > 0 && percentile <= 100)) {
    return 'The percentile runs above 0 up to 100'
  }
  return undefined
}

const ColorRangeDialog = observer(function ColorRangeDialog({
  model,
  handleClose,
}: {
  model: ColorRangeHost
  handleClose: () => void
}) {
  const [text, setText] = useState({
    min: textOf(model.colorDomainMin),
    max: textOf(model.colorDomainMax),
    percentile: `${Math.round(model.colorQuantile * 1000) / 10}`,
  })
  const min = parse(text.min)
  const max = parse(text.max)
  const percentile = parse(text.percentile)
  const error = colorRangeProblem(min, max, percentile)
  const [lo, hi] = model.colorDomain

  return (
    <SubmitDialog
      open
      title="Color range"
      submitText="Apply"
      submitDisabled={error !== undefined}
      onCancel={handleClose}
      onSubmit={() => {
        model.setColorRange({ min, max, quantile: percentile! / 100 })
        handleClose()
      }}
      actions={
        <Button
          variant="contained"
          color="inherit"
          onClick={() => {
            model.resetColorRange()
            handleClose()
          }}
        >
          Reset to defaults
        </Button>
      }
    >
      <div style={{ display: 'flex', gap: 16 }}>
        {(['min', 'max', 'percentile'] as const).map(field => (
          <TextField
            key={field}
            label={
              field === 'min'
                ? 'Min'
                : field === 'max'
                  ? 'Max'
                  : 'Percentile for an empty max'
            }
            placeholder={field === 'percentile' ? undefined : 'auto'}
            value={text[field]}
            autoComplete="off"
            size="small"
            variant="standard"
            slotProps={{
              inputLabel: { shrink: true },
              htmlInput: { inputMode: 'decimal' },
            }}
            onChange={event => {
              setText({ ...text, [field]: event.target.value })
            }}
          />
        ))}
      </div>
      {error ? (
        <FormHelperText error>{error}</FormHelperText>
      ) : (
        <Typography variant="body2" color="text.secondary">
          Colors now span {fmt(lo)} – {fmt(hi)}. An empty max saturates at the
          percentile of the loaded counts; 100 is their maximum.
        </Typography>
      )}
    </SubmitDialog>
  )
})

export default ColorRangeDialog
