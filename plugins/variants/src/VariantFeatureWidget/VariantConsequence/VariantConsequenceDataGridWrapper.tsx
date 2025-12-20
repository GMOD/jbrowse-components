import { useState } from 'react'

import { measureGridWidth } from '@jbrowse/core/util'
import { Checkbox, FormControlLabel, Typography } from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'

import type { GridColDef, GridValidRowModel } from '@mui/x-data-grid'

export default function VariantConsequenceDataGridWrapper({
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
        label={<Typography variant="body2">Show options</Typography>}
        control={
          <Checkbox
            checked={checked}
            onChange={event => {
              setChecked(event.target.checked)
            }}
          />
        }
      />

      <DataGrid
        rowHeight={25}
        hideFooter={rows.length < 100}
        rows={rows}
        showToolbar={checked}
        columns={columns.map(
          (c, i) =>
            ({
              ...c,
              width: widths[i],
            }) satisfies GridColDef<(typeof rows)[0]>,
        )}
      />
    </div>
  ) : null
}
