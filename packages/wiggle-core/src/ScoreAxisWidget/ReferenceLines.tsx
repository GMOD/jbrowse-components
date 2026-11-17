import { Suspense, lazy } from 'react'

import { DEFAULT_RULE_COLOR } from '@jbrowse/display-ui/yAxisConstants'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import { IconButton, TextField } from '@mui/material'
import { observer } from 'mobx-react'

import Section from './Section.tsx'
import { useLiveDraft } from './useLiveDraft.ts'

import type { ScoreAxisDisplay } from './types.ts'
import type { ValueScaleRule } from '@jbrowse/display-ui'

const PopoverPicker = lazy(() => import('@jbrowse/core/ui/PopoverPicker'))

interface Row {
  value: string
  label: string
  color: string
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

// Read back the way the model holds a row, so 1.50 and 1.5 are one value.
function rowsKey(rows: Row[]) {
  return JSON.stringify(
    rows.filter(row => !blank(row)).map(row => rowOf(ruleOf(row))),
  )
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
 * label and its color, an unset color drawing the default grey. A row with no
 * value yet is left out; one whose value does not read holds every row back.
 * Removing a line writes at once; typing and dragging a color wait for a pause.
 */
export default observer(function ReferenceLines({
  display,
}: {
  display: ScoreAxisDisplay
}) {
  const heldRows = () => (display.scoreRules ?? []).map(rowOf)
  const { draft, edit, flush } = useLiveDraft<Row[]>({
    node: display,
    held: () => rowsKey(heldRows()),
    write: next => {
      if (
        next.every(row => blank(row) || valueOk(row)) &&
        rowsKey(next) !== rowsKey(heldRows())
      ) {
        display.setScoreRules?.(next.filter(row => !blank(row)).map(ruleOf))
      }
    },
  })
  const rows = draft ?? heldRows()
  const setRow = (index: number, patch: Partial<Row>) => {
    edit(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }
  return (
    <Section
      title="Reference lines"
      action={
        <IconButton
          aria-label="Add line"
          size="small"
          onClick={() => {
            edit([...rows, { value: '', label: '', color: '' }])
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
            onBlur={flush}
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
            onBlur={flush}
          />
          <Suspense fallback={null}>
            <PopoverPicker
              color={row.color || DEFAULT_RULE_COLOR}
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
              edit(rows.filter((_, i) => i !== index))
              flush()
            }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </div>
      ))}
    </Section>
  )
})
