import React, { useState } from 'react'
import {
  DataGrid,
  GridColDef,
  GridToolbar,
  GridValidRowModel,
} from '@mui/x-data-grid'
import { Checkbox, FormControlLabel, Typography } from '@mui/material'
import ResizeBar, { useResizeBar } from '@jbrowse/core/ui/ResizeBar'
import { measureGridWidth } from '@jbrowse/core/util'

export default function VariantAnnotPanel({
  rows,
  columns,
}: {
  rows: GridValidRowModel[]
  columns: GridColDef[]
}) {
  const { ref, scrollLeft } = useResizeBar()
  const [checked, setChecked] = useState(false)
  const [widths, setWidths] = useState(
    columns.map(e => measureGridWidth(rows.map(r => r[e.field]))),
  )

  return rows.length ? (
    <div ref={ref}>
      <FormControlLabel
        control={
          <Checkbox
            checked={checked}
            onChange={event => setChecked(event.target.checked)}
          />
        }
        label={<Typography variant="body2">Show options</Typography>}
      />
      <div ref={ref}>
        <ResizeBar
          widths={widths}
          setWidths={setWidths}
          scrollLeft={scrollLeft}
        />
        <DataGrid
          rowHeight={25}
          rows={rows}
          columns={columns.map((c, i) => ({ ...c, width: widths[i] }))}
          slots={{ toolbar: checked ? GridToolbar : null }}
        />
      </div>
    </div>
  ) : null
}
