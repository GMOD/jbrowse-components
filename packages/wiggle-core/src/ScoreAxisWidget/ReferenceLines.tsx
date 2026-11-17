import { Suspense, lazy, useState } from 'react'

import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import { IconButton, TextField } from '@mui/material'
import { observer } from 'mobx-react'

import Section from './Section.tsx'

import type { ScoreAxisDisplay } from './types.ts'
import type { ValueScaleRule } from '@jbrowse/display-ui'

const PopoverPicker = lazy(() => import('@jbrowse/core/ui/PopoverPicker'))

interface Row {
  value: string
  label: string
  color: string
}

// Rows typed against the rules as they stood; a write from anywhere else
// (undo, Reset) changes the rules, and the rows show them again.
interface Draft {
  rows: Row[]
  base: string
}

function rowOf({ value, label = '', color = '' }: ValueScaleRule): Row {
  return { value: String(value), label, color }
}

function blank({ value }: Row) {
  return value.trim() === ''
}

function valueOk({ value }: Row) {
  return Number.isFinite(Number(value))
}

function ruleOf(row: Row): ValueScaleRule {
  return {
    value: Number(row.value),
    ...(row.label ? { label: row.label } : {}),
    ...(row.color ? { color: row.color } : {}),
  }
}

/**
 * `encoding.y.rules`, one row per line: its value on the plot's own scale, its
 * label and its color, an unset color taking the display's. A row with no
 * value yet is left out; one whose value does not read holds every row back.
 */
export default observer(function ReferenceLines({
  display,
}: {
  display: ScoreAxisDisplay
}) {
  const rules = display.scoreRules ?? []
  const base = JSON.stringify(rules)
  const [draft, setDraft] = useState<Draft>()
  const rows = draft?.base === base ? draft.rows : rules.map(rowOf)

  const commit = (next: Row[]) => {
    if (next.every(row => blank(row) || valueOk(row))) {
      display.setScoreRules?.(next.filter(row => !blank(row)).map(ruleOf))
    }
    setDraft({ rows: next, base: JSON.stringify(display.scoreRules ?? []) })
  }
  const setRow = (index: number, patch: Partial<Row>) => {
    commit(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }
  return (
    <Section
      title="Reference lines"
      action={
        <IconButton
          aria-label="Add line"
          size="small"
          onClick={() => {
            setDraft({
              rows: [...rows, { value: '', label: '', color: '' }],
              base,
            })
          }}
        >
          <AddIcon fontSize="small" />
        </IconButton>
      }
    >
      {rows.map((row, index) => (
        <div
          // eslint-disable-next-line @eslint-react/no-array-index-key -- rows have no identity but their position
          key={index}
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr auto auto',
            columnGap: 8,
            alignItems: 'center',
          }}
        >
          <TextField
            placeholder="Value"
            size="small"
            variant="standard"
            value={row.value}
            error={!blank(row) && !valueOk(row)}
            slotProps={{
              htmlInput: { inputMode: 'decimal', 'aria-label': 'Value' },
            }}
            onChange={event => {
              setRow(index, { value: event.target.value })
            }}
          />
          <TextField
            placeholder="Label"
            size="small"
            variant="standard"
            value={row.label}
            slotProps={{ htmlInput: { 'aria-label': 'Label' } }}
            onChange={event => {
              setRow(index, { label: event.target.value })
            }}
          />
          <Suspense fallback={null}>
            <PopoverPicker
              color={row.color || 'auto'}
              unset={!row.color}
              onChange={color => {
                setRow(index, { color })
              }}
            />
          </Suspense>
          <IconButton
            aria-label="Remove line"
            size="small"
            onClick={() => {
              commit(rows.filter((_, i) => i !== index))
            }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </div>
      ))}
    </Section>
  )
})
