import { useRef, useState } from 'react'

import { useFinalUnmount } from '@jbrowse/core/util/hooks'
import { isAlive } from '@jbrowse/mobx-state-tree'
import { FormHelperText, TextField, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { toP } from '../formatNumber.ts'
import { writeThrough } from './writeThrough.ts'

import type { ScoreAxisDisplay } from './types.ts'

const DEBOUNCE_MS = 300

// '' is "follow the data"; anything else that isn't a number is held back
// rather than read as empty, which would unpin the end.
function parse(text: string) {
  const trimmed = text.trim()
  return trimmed === '' ? undefined : Number(trimmed)
}

function problem(
  min: number | undefined,
  max: number | undefined,
  scaleType: string,
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

function formatRange([lo, hi]: [number, number]) {
  return `${toP(lo, 4)} – ${toP(hi, 4)}`
}

// Typing 190 would otherwise redraw at 1 and 19 on the way; the pair writes
// once the typing pauses, and at once on blur or when the drawer closes.
export default observer(function RangeFields({
  display,
}: {
  display: ScoreAxisDisplay
}) {
  const { manualMinScore, manualMaxScore, scaleType, autoscaleRange } = display
  const [text, setText] = useState({
    min: manualMinScore === undefined ? '' : `${manualMinScore}`,
    max: manualMaxScore === undefined ? '' : `${manualMaxScore}`,
  })
  const latest = useRef(text)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const flush = () => {
    clearTimeout(timer.current)
    timer.current = undefined
    const min = parse(latest.current.min)
    const max = parse(latest.current.max)
    if (
      isAlive(display) &&
      problem(min, max, display.scaleType) === undefined &&
      (min !== display.manualMinScore || max !== display.manualMaxScore)
    ) {
      writeThrough(display, () => {
        display.setMinScore(min)
        display.setMaxScore(max)
      })
    }
  }
  useFinalUnmount(flush)

  const edit = (patch: Partial<typeof text>) => {
    const next = { ...latest.current, ...patch }
    latest.current = next
    setText(next)
    clearTimeout(timer.current)
    timer.current = setTimeout(flush, DEBOUNCE_MS)
  }
  const error = problem(parse(text.min), parse(text.max), scaleType)

  return (
    <>
      <div style={{ display: 'flex', gap: 16 }}>
        {(['min', 'max'] as const).map(end => (
          <TextField
            key={end}
            label={end === 'min' ? 'Min' : 'Max'}
            placeholder="auto"
            value={text[end]}
            error={error !== undefined}
            autoComplete="off"
            size="small"
            variant="standard"
            slotProps={{
              inputLabel: { shrink: true },
              htmlInput: { inputMode: 'decimal' },
            }}
            onChange={event => {
              edit({ [end]: event.target.value })
            }}
            onBlur={flush}
          />
        ))}
      </div>
      {error ? (
        <FormHelperText error>{error}</FormHelperText>
      ) : autoscaleRange ? (
        <Typography variant="body2" color="text.secondary">
          Values in view: {formatRange(autoscaleRange)}
        </Typography>
      ) : null}
    </>
  )
})
