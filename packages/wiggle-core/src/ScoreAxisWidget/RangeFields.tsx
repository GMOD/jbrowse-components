import { useRef, useState } from 'react'

import { useFinalUnmount } from '@jbrowse/core/util/hooks'
import { isAlive } from '@jbrowse/mobx-state-tree'
import { FormHelperText, TextField } from '@mui/material'
import { observer } from 'mobx-react'

import { toP } from '../formatNumber.ts'

import type { ScoreAxisDisplay } from './types.ts'
import type { ScaleType } from '@jbrowse/display-ui/yAxisConstants'

const DEBOUNCE_MS = 300

type End = 'min' | 'max'

const ENDS = [
  { end: 'min', label: 'Min', at: 0 },
  { end: 'max', label: 'Max', at: 1 },
] as const

// Text typed against the value the end held at the time. A write from
// anywhere else (undo, Reset, a menu, an agent) leaves the end holding
// something other than `base`, and the field then shows the end again.
interface Draft {
  text: string
  base: number | undefined
}

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

function pinned(display: ScoreAxisDisplay, end: End) {
  return end === 'min' ? display.domainMin : display.domainMax
}

function current(drafts: Partial<Record<End, Draft>>, end: End, held?: number) {
  const draft = drafts[end]
  return draft && draft.base === held ? draft : undefined
}

// Typing 190 would otherwise redraw at 1 and 19 on the way; the pair writes
// once the typing pauses, and at once on blur or when the drawer closes.
export default observer(function RangeFields({
  display,
}: {
  display: ScoreAxisDisplay
}) {
  const { scaleType, autoscaledDomain } = display
  const [drafts, setDrafts] = useState<Partial<Record<End, Draft>>>({})
  const latest = useRef(drafts)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const store = (next: Partial<Record<End, Draft>>) => {
    latest.current = next
    setDrafts(next)
  }

  const flush = () => {
    clearTimeout(timer.current)
    timer.current = undefined
    if (isAlive(display)) {
      const read = (end: End) => {
        const held = pinned(display, end)
        const draft = current(latest.current, end, held)
        return { draft, value: draft ? parse(draft.text) : held }
      }
      const min = read('min')
      const max = read('max')
      if (problem(min.value, max.value, display.scaleType) === undefined) {
        if (min.value !== display.domainMin) {
          display.setDomainMin(min.value)
        }
        if (max.value !== display.domainMax) {
          display.setDomainMax(max.value)
        }
        store({
          min: min.draft && { ...min.draft, base: min.value },
          max: max.draft && { ...max.draft, base: max.value },
        })
      }
    }
  }
  useFinalUnmount(flush)

  const edit = (end: End, text: string) => {
    store({ ...latest.current, [end]: { text, base: pinned(display, end) } })
    clearTimeout(timer.current)
    timer.current = setTimeout(flush, DEBOUNCE_MS)
  }

  const shown = (end: End) => {
    const held = pinned(display, end)
    return (
      current(drafts, end, held)?.text ?? (held === undefined ? '' : `${held}`)
    )
  }
  const error = problem(parse(shown('min')), parse(shown('max')), scaleType)

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
            value={shown(end)}
            error={error !== undefined}
            autoComplete="off"
            size="small"
            variant="standard"
            slotProps={{
              inputLabel: { shrink: true },
              htmlInput: { inputMode: 'decimal' },
            }}
            onChange={event => {
              edit(end, event.target.value)
            }}
            onBlur={flush}
          />
        ))}
      </div>
      {error ? <FormHelperText error>{error}</FormHelperText> : null}
    </>
  )
})
