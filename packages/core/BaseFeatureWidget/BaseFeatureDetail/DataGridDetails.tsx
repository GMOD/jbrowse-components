import React, { useState } from 'react'
import { makeStyles } from 'tss-react/mui'
import { DataGrid, GridToolbar } from '@mui/x-data-grid'
import { Checkbox, FormControlLabel, Typography } from '@mui/material'

// locals
import { measureGridWidth, getStr } from '../../util'
import ResizeBar from '../../ui/ResizeBar'
import FieldName from './FieldName'
import { useResizeBar } from '../../ui/useResizeBar'
import { SanitizedHTML } from '../../ui'

const useStyles = makeStyles()(theme => ({
  margin: {
    margin: theme.spacing(1),
    width: '100%',
  },

  cell: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
}))

interface Entry {
  id: string
  [key: string]: string
}

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
  const { ref, scrollLeft } = useResizeBar()
  const [checked, setChecked] = useState(false)
  const keys = Object.keys(value[0]).sort()
  const unionKeys = new Set(keys)

  // avoids key 'id' from being used in row data
  const rows = Object.entries(value).map(([k, val]) => {
    const { id, ...rest } = val
    return {
      id: k, // used by material UI
      identifier: id, // renamed from id to identifier
      ...rest,
    } as Entry
  })

  for (const val of value) {
    for (const k of Object.keys(val)) {
      unionKeys.add(k)
    }
  }
  // avoids key 'id' from being used in column names, and tries
  // to make it at the start of the colNames array
  let colNames: string[]
  if (unionKeys.has('id')) {
    unionKeys.delete('id')
    colNames = ['identifier', ...unionKeys]
  } else {
    colNames = [...unionKeys]
  }
  const [widths, setWidths] = useState(
    colNames.map(e => measureGridWidth(rows.map(r => r[e]))),
  )

  if (unionKeys.size < keys.length + 5) {
    return (
      <>
        <FieldName prefix={prefix} name={name} />
        <FormControlLabel
          control={
            <Checkbox
              checked={checked}
              onChange={event => setChecked(event.target.checked)}
            />
          }
          label={<Typography variant="body2">Show options</Typography>}
        />
        <div className={classes.margin} ref={ref}>
          <ResizeBar
            widths={widths}
            setWidths={setWidths}
            scrollLeft={scrollLeft}
          />
          <DataGrid
            disableRowSelectionOnClick
            // @ts-expect-error the rows gets confused by the renderCell of the
            // columns below
            rows={rows}
            rowCount={25}
            rowHeight={25}
            columnHeaderHeight={35}
            hideFooter={rows.length < 25}
            slots={{ toolbar: checked ? GridToolbar : null }}
            slotProps={{
              toolbar: {
                printOptions: {
                  disableToolbarButton: true,
                },
              },
            }}
            columns={colNames.map((val, index) => ({
              field: val,
              renderCell: params => {
                const value = params.value as string
                return (
                  <div className={classes.cell}>
                    <SanitizedHTML html={getStr(value)} />
                  </div>
                )
              },
              width: widths[index],
            }))}
          />
        </div>
      </>
    )
  }
  return null
}
