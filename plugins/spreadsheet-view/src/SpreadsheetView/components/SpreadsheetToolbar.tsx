import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import ClearableSearchField from '@jbrowse/core/ui/ClearableSearchField'
import ControlRow from '@jbrowse/core/ui/ControlRow'
import { saveAs } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import GetAppIcon from '@mui/icons-material/GetApp'
import ViewColumnIcon from '@mui/icons-material/ViewColumn'
import { IconButton, MenuItem, TextField, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import type { SpreadsheetModel } from '../SpreadsheetModel.tsx'

const useStyles = makeStyles()(theme => ({
  toolbar: {
    flexWrap: 'wrap',
    margin: theme.spacing(1),
  },
  search: {
    minWidth: 240,
  },
}))

const SpreadsheetToolbar = observer(function SpreadsheetToolbar({
  model,
}: {
  model: SpreadsheetModel
}) {
  const { classes } = useStyles()
  const { gridFacets, rows, visibleRows, sheetColumns, visibleColumns } = model
  const total = rows?.length ?? 0
  const shown = visibleRows?.length ?? 0
  return (
    <ControlRow className={classes.toolbar}>
      {gridFacets.map(({ id, label, multiple, selected, options }) => {
        const known = selected.filter(key => options.some(o => o.key === key))
        return (
          <TextField
            key={id}
            select
            variant="outlined"
            size="small"
            label={label}
            value={multiple ? known : (known[0] ?? '')}
            onChange={event => {
              // a multiple select hands back an array
              model.setGridFacet(
                id,
                [event.target.value].flat().filter(key => key !== ''),
              )
            }}
            sx={{ minWidth: 160, maxWidth: 320 }}
            slotProps={{
              htmlInput: { 'data-testid': id },
              inputLabel: { shrink: true },
              select: {
                multiple,
                displayEmpty: true,
                renderValue: multiple
                  ? () => (known.length ? known.join(', ') : 'All')
                  : undefined,
              },
            }}
          >
            {multiple ? null : <MenuItem value="">All</MenuItem>}
            {options.map(opt => (
              <MenuItem key={opt.key} value={opt.key}>
                {opt.label}
              </MenuItem>
            ))}
          </TextField>
        )
      })}
      <ClearableSearchField
        className={classes.search}
        label="Search rows"
        value={model.filterText ?? ''}
        status={shown === total ? `${total} rows` : `${shown} of ${total}`}
        onChange={value => {
          model.setFilterText(value)
        }}
      />
      <CascadingMenuButton
        tooltip="Show or hide columns"
        closeAfterItemClick={false}
        menuItems={sheetColumns.map(col => {
          const checked = visibleColumns[col.field] !== false
          return {
            label: col.header,
            type: 'checkbox' as const,
            checked,
            onClick: () => {
              model.setColumnVisible(col.field, !checked)
            },
          }
        })}
      >
        <ViewColumnIcon />
      </CascadingMenuButton>
      <Tooltip title="Export the rows on view as CSV">
        <IconButton
          aria-label="Export CSV"
          onClick={() => {
            saveAs(
              new Blob([model.csvText()], { type: 'text/csv;charset=utf-8' }),
              'spreadsheet.csv',
            )
          }}
        >
          <GetAppIcon />
        </IconButton>
      </Tooltip>
    </ControlRow>
  )
})

export default SpreadsheetToolbar
