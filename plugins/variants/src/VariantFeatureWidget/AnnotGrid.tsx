/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { DataGrid } from '@mui/x-data-grid'

export default function VariantAnnotPanel({
  rows,
  columns,
}: {
  rows: any
  columns: any[]
}) {
  const rowHeight = 25
  const hideFooter = rows.length < 100
  const headerHeight = 80
  return rows.length ? (
    <div
      style={{
        height:
          Math.min(rows.length, 100) * rowHeight +
          headerHeight +
          (hideFooter ? 0 : 50),
        width: '100%',
      }}
    >
      <DataGrid rowHeight={rowHeight} rows={rows} columns={columns} />
    </div>
  ) : null
}
