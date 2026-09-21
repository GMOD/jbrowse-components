import { useState } from 'react'

import { SubmitDialog } from '@jbrowse/core/ui'
import { isCssColor } from '@jbrowse/core/util/colorBits'
import DeleteIcon from '@mui/icons-material/Delete'
import { Button, IconButton, TextField, Typography } from '@mui/material'
import { observer } from 'mobx-react'

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

/**
 * The score menu's editor for `scales.y.rules`: one row per reference line,
 * its value on the plot's own scale, its label and its colour. An empty colour
 * is the display's default, and removing every row removes every line.
 */
export default observer(function SetScoreRulesDialog({
  model,
  handleClose,
}: {
  model: {
    scoreRules: ValueScaleRule[]
    setScoreRules: (rules: ValueScaleRule[]) => void
  }
  handleClose: () => void
}) {
  const [rows, setRows] = useState(() => model.scoreRules.map(rowOf))
  const setRow = (index: number, patch: Partial<Row>) => {
    setRows(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }
  return (
    <SubmitDialog
      open
      title="Reference lines"
      submitDisabled={!rows.every(row => valueOk(row) && colorOk(row))}
      onCancel={handleClose}
      onSubmit={() => {
        model.setScoreRules(
          rows.map(row => ({
            value: Number(row.value),
            ...(row.label ? { label: row.label } : {}),
            ...(row.color.trim() ? { color: row.color.trim() } : {}),
          })),
        )
        handleClose()
      }}
    >
      <Typography>
        A horizontal line at each value, on the same scale as the plot
      </Typography>
      {rows.map((row, index) => (
        // eslint-disable-next-line @eslint-react/no-array-index-key -- rows have no identity but their position
        <div key={index} style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <TextField
            label="Value"
            value={row.value}
            error={!valueOk(row)}
            onChange={event => {
              setRow(index, { value: event.target.value })
            }}
          />
          <TextField
            label="Label"
            value={row.label}
            onChange={event => {
              setRow(index, { label: event.target.value })
            }}
          />
          <TextField
            label="Color"
            value={row.color}
            error={!colorOk(row)}
            onChange={event => {
              setRow(index, { color: event.target.value })
            }}
          />
          <IconButton
            aria-label="remove line"
            onClick={() => {
              setRows(rows.filter((_, i) => i !== index))
            }}
          >
            <DeleteIcon />
          </IconButton>
        </div>
      ))}
      <Button
        onClick={() => {
          setRows([...rows, { value: '', label: '', color: '' }])
        }}
      >
        Add line
      </Button>
    </SubmitDialog>
  )
})
