import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Checkbox } from '@mui/material'
import { alpha, darken, lighten } from '@mui/material/styles'

import type { Entry, GenomeColumn } from './getColumnDefinitions.tsx'
import type { Sorting } from './useGenomesTableState.ts'

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
        padding: 0,
        '&:hover': {
          backgroundColor: theme.palette.action.hover,
        },
      },
      '& tr:hover': {
        backgroundColor: theme.palette.action.hover,
      },
    },
    // the whole header cell is the sort control, so it has to be the button
    sortButton: {
      font: 'inherit',
      fontWeight: 'inherit',
      color: 'inherit',
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      textAlign: 'left',
      width: '100%',
      padding: '2px 4px',
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
    empty: {
      padding: theme.spacing(3),
      textAlign: 'center',
      color: theme.palette.text.secondary,
    },
  }
})

const checkboxSx = {
  padding: 0,
  '& .MuiSvgIcon-root': { fontSize: '1.15rem' },
}

function ariaSort(sorting: Sorting | undefined, colId: string) {
  return sorting?.id === colId
    ? sorting.desc
      ? 'descending'
      : 'ascending'
    : 'none'
}

export default function GenomesTable({
  columns,
  rows,
  multipleSelection,
  selected,
  setSelected,
  sorting,
  toggleSort,
  emptyMessage,
}: {
  columns: GenomeColumn[]
  rows: Entry[]
  multipleSelection: boolean
  selected: Set<string>
  setSelected: (arg: Set<string>) => void
  sorting?: Sorting
  toggleSort: (colId: string) => void
  emptyMessage: React.ReactNode
}) {
  const { classes } = useStyles()
  const allSelected =
    rows.length > 0 && rows.every(row => selected.has(row.accession))
  const someSelected =
    !allSelected && rows.some(row => selected.has(row.accession))

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
                  setSelected(
                    allSelected
                      ? new Set()
                      : new Set(rows.map(r => r.accession)),
                  )
                }}
                sx={checkboxSx}
              />
            </th>
          ) : null}
          {columns.map(col => (
            <th key={col.id} aria-sort={ariaSort(sorting, col.id)}>
              <button
                type="button"
                className={classes.sortButton}
                onClick={() => {
                  toggleSort(col.id)
                }}
              >
                {col.header}
                {sorting?.id === col.id ? (sorting.desc ? ' ↓' : ' ↑') : ''}
              </button>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length ? (
          rows.map(row => {
            const isSelected = selected.has(row.accession)
            return (
              <tr
                key={row.accession}
                className={isSelected ? classes.selectedRow : undefined}
              >
                {multipleSelection ? (
                  <td className={classes.checkboxCell}>
                    <Checkbox
                      size="small"
                      checked={isSelected}
                      onChange={() => {
                        const next = new Set(selected)
                        if (next.has(row.accession)) {
                          next.delete(row.accession)
                        } else {
                          next.add(row.accession)
                        }
                        setSelected(next)
                      }}
                      sx={checkboxSx}
                    />
                  </td>
                ) : null}
                {columns.map(col => (
                  <td key={col.id}>
                    {col.cell ? col.cell(row) : (col.value?.(row) ?? '')}
                  </td>
                ))}
              </tr>
            )
          })
        ) : (
          <tr>
            <td
              className={classes.empty}
              colSpan={columns.length + (multipleSelection ? 1 : 0)}
            >
              {emptyMessage}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  )
}
