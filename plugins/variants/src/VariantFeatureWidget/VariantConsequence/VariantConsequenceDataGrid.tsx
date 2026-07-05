import { useState } from 'react'

import BaseCard from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'
import { measureGridWidth } from '@jbrowse/core/util'
import { Checkbox, FormControlLabel, Typography } from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'

import type { GridColDef } from '@mui/x-data-grid'

export default function VariantConsequenceDataGrid({
  data,
  fields,
  title,
}: {
  data: string[]
  fields: string[]
  title: string
}) {
  const [showOptions, setShowOptions] = useState(false)
  const rows = data.map((elt, id) => {
    const parts = elt.split('|')
    const row: Record<string, string> = { id: `${id}` }
    for (const [i, field] of fields.entries()) {
      row[field] = parts[i] ?? ''
    }
    return row
  })
  const columns = fields.map(
    field =>
      ({
        field,
        width: measureGridWidth(rows.map(r => r[field])),
      }) satisfies GridColDef<(typeof rows)[0]>,
  )

  return rows.length ? (
    <BaseCard title={title}>
      <FormControlLabel
        label={<Typography variant="body2">Show options</Typography>}
        control={
          <Checkbox
            checked={showOptions}
            onChange={event => {
              setShowOptions(event.target.checked)
            }}
          />
        }
      />
      <DataGrid
        rowHeight={25}
        hideFooter={rows.length < 100}
        rows={rows}
        showToolbar={showOptions}
        columns={columns}
      />
    </BaseCard>
  ) : null
}
