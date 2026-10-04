import { useState } from 'react'

import { isCssColor } from '@jbrowse/core/util/colorBits'
import DeleteIcon from '@mui/icons-material/Delete'
import { Button, IconButton, TextField, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { writeThrough } from './writeThrough.ts'

import type { ScoreAxisDisplay } from './types.ts'
import type { ValueScaleRule } from '@jbrowse/display-ui'

interface Row {
  value: string
  label: string
  color: string
}

function rowOf({ value, label = '', color = '' }: ValueScaleRule): Row {
  return { value: String(value), label, color }
}

function valueOk({ value }: Row) {
  return value.trim() !== '' && Number.isFinite(Number(value))
}

function colorOk({ color }: Row) {
  return color.trim() === '' || isCssColor(color)
}

function ruleOf(row: Row): ValueScaleRule {
  return {
    value: Number(row.value),
    ...(row.label ? { label: row.label } : {}),
    ...(row.color.trim() ? { color: row.color.trim() } : {}),
  }
}

/**
 * `scales.y.rules`, one row per line: its value on the plot's own scale, its
 * label and its colour, an empty colour taking the display's. The lines
 * redraw as soon as every row reads; a half-typed row waits.
 */
export default observer(function ReferenceLines({
  display,
}: {
  display: ScoreAxisDisplay
}) {
  const [rows, setRows] = useState(() => (display.scoreRules ?? []).map(rowOf))
  const commit = (next: Row[]) => {
    setRows(next)
    if (next.every(row => valueOk(row) && colorOk(row))) {
      writeThrough(display, () => {
        display.setScoreRules?.(next.map(ruleOf))
      })
    }
  }
  const setRow = (index: number, patch: Partial<Row>) => {
    commit(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }
  return (
    <div>
      <Typography variant="body2">Reference lines</Typography>
      {rows.map((row, index) => (
        // eslint-disable-next-line @eslint-react/no-array-index-key -- rows have no identity but their position
        <div key={index} style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <TextField
            label="Value"
            size="small"
            variant="standard"
            value={row.value}
            error={!valueOk(row)}
            slotProps={{ htmlInput: { inputMode: 'decimal' } }}
            onChange={event => {
              setRow(index, { value: event.target.value })
            }}
          />
          <TextField
            label="Label"
            size="small"
            variant="standard"
            value={row.label}
            onChange={event => {
              setRow(index, { label: event.target.value })
            }}
          />
          <TextField
            label="Color"
            size="small"
            variant="standard"
            value={row.color}
            error={!colorOk(row)}
            onChange={event => {
              setRow(index, { color: event.target.value })
            }}
          />
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
      <Button
        size="small"
        onClick={() => {
          setRows([...rows, { value: '', label: '', color: '' }])
        }}
      >
        Add line
      </Button>
    </div>
  )
})
