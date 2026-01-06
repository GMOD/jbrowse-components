import { useState } from 'react'

import { SanitizedHTML } from '@jbrowse/core/ui'
import ColorPicker from '@jbrowse/core/ui/ColorPicker'
import { getStr, measureGridWidth } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { DataGrid } from '@mui/x-data-grid'

import type { Source } from '../types.ts'
import type { GridColDef, GridRowId } from '@mui/x-data-grid'

const useStyles = makeStyles()({
  cell: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
})

interface SortField {
  idx: number
  field: string | null
}

export default function SourcesDataGrid({
  rows,
  onChange,
  setSelected,
}: {
  rows: Source[]
  onChange: (arg: Source[]) => void
  setSelected: (arg: GridRowId[]) => void
}) {
  const { classes } = useStyles()
  const {
    id: _id,
    name: _name,
    label: _label,
    color: _color,
    baseUri: _baseUri,
    HP: _HP,
    ...rest
  } = rows[0]!
  const [currSort, setCurrSort] = useState<SortField>({
    idx: 0,
    field: null,
  })

  return (
    <div style={{ height: 400, width: '100%' }}>
      <DataGrid
        checkboxSelection
        disableRowSelectionOnClick
        onRowSelectionModelChange={arg => {
          setSelected([...arg.ids])
        }}
        rows={rows}
        rowHeight={25}
        columnHeaderHeight={33}
        columns={[
          {
            field: 'color',
            headerName: 'Color',
            renderCell: params => {
              const { value, id } = params
              return (
                <ColorPicker
                  color={value || 'blue'}
                  onChange={c => {
                    const elt = rows.find(f => f.name === id)
                    if (elt) {
                      elt.color = c
                    }
                    onChange([...rows])
                  }}
                />
              )
            },
          },
          {
            field: 'label',
            headerName: 'Name',
            width: measureGridWidth(rows.map(r => r.label)),
          },
          ...Object.keys(rest).map(
            val =>
              ({
                field: val,
                renderCell: ({ value }) => (
                  <div className={classes.cell}>
                    <SanitizedHTML html={getStr(value)} />
                  </div>
                ),
                width: measureGridWidth(
                  rows.map(r => `${r[val as keyof Source]}`),
                ),
              }) satisfies GridColDef<(typeof rows)[0]>,
          ),
        ]}
        sortModel={
          [
            /* we control the sort as a controlled component using
             * onSortModelChange */
          ]
        }
        onSortModelChange={args => {
          const sort = args[0]
          // this idx%2 flip flops the sorting order, we could inspect args
          // for sort direction asc or desc but this is just a simplified
          // thing since we are controlling sort instead of the default data
          // grid sort anyways
          const idx = (currSort.idx + 1) % 2
          const field = sort!.field || currSort.field
          setCurrSort({ idx, field })
          onChange(
            field
              ? [...rows].sort((a, b) => {
                  const aa = getStr(a[field as keyof Source])
                  const bb = getStr(b[field as keyof Source])
                  return idx === 1 ? aa.localeCompare(bb) : bb.localeCompare(aa)
                })
              : rows,
          )
        }}
      />
    </div>
  )
}
