import { useState } from 'react'

import { Checkbox, FormControlLabel, Typography } from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'

import DataGridFlexContainer from '../../ui/DataGridFlexContainer.tsx'
import { SanitizedHTML } from '../../ui/index.ts'
import { getStr, measureGridWidth } from '../../util/index.ts'
import { makeStyles } from '../../util/tss-react/index.ts'
import FieldName from './FieldName.tsx'

import type { GridColDef } from '@mui/x-data-grid'

const useStyles = makeStyles()(theme => ({
  margin: {
    marginBottom: theme.spacing(4),
  },

  cell: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
}))

export default function DataGridDetails({
  value,
  prefix,
  name,
}: {
  name: string
  prefix?: string[]
  value: Record<string, unknown>[]
}) {
  const { classes } = useStyles()
  const [checked, setChecked] = useState(false)

  // DataGrid needs a unique row id; rather than commandeering any 'id' field
  // the feature itself carries, tag each row with the array index and point
  // getRowId at it, leaving the feature's own keys (including 'id') untouched
  const rows = value.map((val, k) => ({ ...val, __dataGridRowId: k }))

  const cols = [...new Set(value.flatMap(Object.keys))]
  const widths = cols.map(col => measureGridWidth(value.map(r => r[col])))
  return (
    <div className={classes.margin}>
      <FieldName prefix={prefix} name={name} />
      <FormControlLabel
        control={
          <Checkbox
            checked={checked}
            onChange={e => {
              setChecked(e.target.checked)
            }}
          />
        }
        label={<Typography variant="body2">Show options</Typography>}
      />
      <DataGridFlexContainer>
        <DataGrid
          disableRowSelectionOnClick
          rows={rows}
          getRowId={row => row.__dataGridRowId}
          rowHeight={20}
          columnHeaderHeight={35}
          hideFooter={rows.length < 25}
          showToolbar={checked}
          columns={cols.map(
            (field, index) =>
              ({
                field,
                width: widths[index],
                renderCell: ({ value }) => (
                  <div className={classes.cell}>
                    <SanitizedHTML html={getStr(value ?? '')} />
                  </div>
                ),
              }) satisfies GridColDef<(typeof rows)[0]>,
          )}
        />
      </DataGridFlexContainer>
    </div>
  )
}
