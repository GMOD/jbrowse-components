import { FormHelperText, TextField } from '@mui/material'
import { observer } from 'mobx-react'

import { toP } from '../formatNumber.ts'
import { useLiveDraft } from './useLiveDraft.ts'

import type { ScoreAxisDisplay } from './types.ts'
import type { ScaleType } from '@jbrowse/display-ui/yAxisConstants'

interface Texts {
  min: string
  max: string
}

const ENDS = [
  { end: 'min', label: 'Min', at: 0 },
  { end: 'max', label: 'Max', at: 1 },
] as const

// '' is "follow the data"; anything else that isn't a number is held back
// rather than read as empty, which would unpin the end.
function parse(text: string) {
  const trimmed = text.trim()
  return trimmed === '' ? undefined : Number(trimmed)
}

function problem(
  min: number | undefined,
  max: number | undefined,
  scaleType: ScaleType,
) {
  if (Number.isNaN(min) || Number.isNaN(max)) {
    return 'Enter a number, or leave the field empty to follow the data'
  }
  if (min !== undefined && max !== undefined && !(max > min)) {
    return 'Max must be greater than min'
  }
  if (scaleType === 'log' && min !== undefined && min <= 0) {
    return 'A log axis needs a min above 0'
  }
  return undefined
}

function textOf(n: number | undefined) {
  return n === undefined ? '' : `${n}`
}

export default observer(function RangeFields({
  display,
}: {
  display: ScoreAxisDisplay
}) {
  const { scaleType, autoscaledDomain } = display
  const { draft, edit, flush } = useLiveDraft<Texts>({
    node: display,
    held: () => `${display.domainMin}|${display.domainMax}`,
    write: ({ min, max }) => {
      const lo = parse(min)
      const hi = parse(max)
      if (problem(lo, hi, display.scaleType) === undefined) {
        if (lo !== display.domainMin) {
          display.setDomainMin(lo)
        }
        if (hi !== display.domainMax) {
          display.setDomainMax(hi)
        }
      }
    },
  })
  const texts = draft ?? {
    min: textOf(display.domainMin),
    max: textOf(display.domainMax),
  }
  const error = problem(parse(texts.min), parse(texts.max), scaleType)

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {ENDS.map(({ end, label, at }) => (
          <TextField
            key={end}
            label={label}
            placeholder={
              autoscaledDomain
                ? `auto (${toP(autoscaledDomain[at], 4)})`
                : 'auto'
            }
            value={texts[end]}
            error={error !== undefined}
            autoComplete="off"
            size="small"
            variant="standard"
            slotProps={{
              inputLabel: { shrink: true },
              htmlInput: { inputMode: 'decimal' },
            }}
            onChange={event => {
              edit({ ...texts, [end]: event.target.value })
            }}
            onBlur={flush}
          />
        ))}
      </div>
      {error ? <FormHelperText error>{error}</FormHelperText> : null}
    </>
  )
})
