import React, { useState } from 'react'
import {
  DataGrid,
  GridColDef,
  GridToolbar,
  GridValidRowModel,
} from '@mui/x-data-grid'
import { Checkbox, FormControlLabel, Typography } from '@mui/material'

export default function VariantAnnotPanel({
  rows,
  columns,
}: {
  rows: GridValidRowModel[]
  columns: GridColDef[]
}) {
  const rowHeight = 25
  const headerHeight = 100
  const footerHeight = 50
  const [checked, setChecked] = useState(false)
  const height =
    Math.min(rows.length, 100) * rowHeight +
    headerHeight +
    (checked ? 50 : 0) +
    footerHeight
  return rows.length ? (
    <div>
      <FormControlLabel
        control={
          <Checkbox
            checked={checked}
            onChange={event => setChecked(event.target.checked)}
          />
        }
        label={<Typography variant="body2">Show options</Typography>}
      />
      <div
        style={{
          height,
          width: '100%',
        }}
      >
        <DataGrid
          rowHeight={rowHeight}
          rows={rows}
          columns={columns}
          slots={{ toolbar: checked ? GridToolbar : null }}
        />
      </div>
    </div>
  ) : null
}
