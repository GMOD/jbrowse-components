import React, { useState } from 'react'
import {
  DataGrid,
  GridColDef,
  GridToolbar,
  GridValidRowModel,
} from '@mui/x-data-grid'
import { Checkbox, FormControlLabel, Typography } from '@mui/material'
import { measureGridWidth } from '@jbrowse/core/util'

export default function VariantAnnotPanel({
  rows,
  columns,
}: {
  rows: GridValidRowModel[]
  columns: GridColDef[]
}) {
  const [checked, setChecked] = useState(false)
  const widths = columns.map(e => measureGridWidth(rows.map(r => r[e.field])))

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

      <DataGrid
        rowHeight={25}
        rows={rows}
        columns={columns.map((c, i) => ({ ...c, width: widths[i] }))}
        slots={{ toolbar: checked ? GridToolbar : null }}
      />
    </div>
  ) : null
}
