import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Checkbox } from '@mui/material'
import { alpha, darken, lighten } from '@mui/material/styles'

import type { Entry, GenomeColumn } from './getColumnDefinitions.tsx'

const useStyles = makeStyles()(theme => {
  const borderColor =
    theme.palette.mode === 'light'
      ? lighten(alpha(theme.palette.divider, 1), 0.88)
      : darken(alpha(theme.palette.divider, 1), 0.68)
  const border = `1px solid ${borderColor}`
  return {
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      '& th, & td': {
        textAlign: 'left',
        padding: '2px 4px',
        borderBottom: border,
        fontSize: theme.typography.body2.fontSize,
      },
      '& th': {
        backgroundColor: theme.palette.background.paper,
        fontWeight: theme.typography.fontWeightMedium,
        cursor: 'pointer',
        '&:hover': {
          backgroundColor: theme.palette.action.hover,
        },
      },
      '& tr:hover': {
        backgroundColor: theme.palette.action.hover,
      },
    },
    selectedRow: {
      backgroundColor: alpha(
        theme.palette.primary.main,
        theme.palette.action.selectedOpacity,
      ),
      '&:hover': {
        backgroundColor: alpha(
          theme.palette.primary.main,
          theme.palette.action.selectedOpacity +
            theme.palette.action.hoverOpacity,
        ),
      },
    },
    checkboxCell: {
      padding: 0,
      textAlign: 'center',
      verticalAlign: 'middle',
    },
  }
})

const checkboxSx = {
  padding: 0,
  '& .MuiSvgIcon-root': { fontSize: '1.15rem' },
}

export default function GenomesTable({
  columns,
  rows,
  multipleSelection,
  selected,
  setSelected,
  sorting,
  toggleSort,
}: {
  columns: GenomeColumn[]
  rows: Entry[]
  multipleSelection: boolean
  selected: Set<string>
  setSelected: (arg: Set<string>) => void
  sorting?: { id: string; desc: boolean }
  toggleSort: (colId: string) => void
}) {
  const { classes } = useStyles()
  const allSelected = rows.length > 0 && rows.every(row => selected.has(row.id))
  const someSelected = !allSelected && rows.some(row => selected.has(row.id))

  return (
    <table className={classes.table}>
      <thead>
        <tr>
          {multipleSelection ? (
            <th className={classes.checkboxCell}>
              <Checkbox
                size="small"
                checked={allSelected}
                indeterminate={someSelected}
                onChange={() => {
                  if (allSelected) {
                    setSelected(new Set())
                  } else {
                    setSelected(new Set(rows.map(r => r.id)))
                  }
                }}
                sx={checkboxSx}
              />
            </th>
          ) : null}
          {columns.map(col => (
            <th
              key={col.id}
              onClick={() => {
                toggleSort(col.id)
              }}
            >
              {col.header}
              {sorting?.id === col.id ? (sorting.desc ? ' ↓' : ' ↑') : ''}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(row => {
          const isSelected = selected.has(row.id)
          return (
            <tr
              key={row.id}
              className={isSelected ? classes.selectedRow : undefined}
            >
              {multipleSelection ? (
                <td className={classes.checkboxCell}>
                  <Checkbox
                    size="small"
                    checked={isSelected}
                    onChange={() => {
                      const next = new Set(selected)
                      if (next.has(row.id)) {
                        next.delete(row.id)
                      } else {
                        next.add(row.id)
                      }
                      setSelected(next)
                    }}
                    sx={checkboxSx}
                  />
                </td>
              ) : null}
              {columns.map(col => (
                <td key={col.id}>
                  {col.cell ? col.cell(row) : `${row[col.id] ?? ''}`}
                </td>
              ))}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
