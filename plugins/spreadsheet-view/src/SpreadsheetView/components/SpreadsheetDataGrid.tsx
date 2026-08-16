import { useEffect } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Chip, MenuItem, TextField } from '@mui/material'
import { DataGrid, useGridApiRef } from '@mui/x-data-grid'
import {
  gridQuickFilterValuesSelector,
  gridVisibleRowsLookupSelector,
} from '@mui/x-data-grid/hooks'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import type { SpreadsheetModel } from '../SpreadsheetModel.tsx'

const useStyles = makeStyles()(theme => ({
  // the row the circle's selected chord belongs to. Deliberately not the grid's
  // own row-selection model, which is the reader's multi-select for exports and
  // would be taken over by every chord click
  selectedRow: {
    background: theme.palette.action.selected,
  },
}))

// stable id so the dropdown's filter item is upserted/replaced in place rather
// than stacking alongside the user's own column filters and quick-filter search
const SV_TYPE_FILTER_ID = 'sv-type-quick-filter'

function disposeAll(disposers: (() => void)[]) {
  return () => {
    for (const dispose of disposers) {
      dispose()
    }
  }
}

const SpreadsheetDataGrid = observer(function SpreadsheetDataGrid({
  model,
}: {
  model: SpreadsheetModel
}) {
  const {
    rows,
    dataGridColumns,
    visibleColumns,
    svTypeColumnField,
    svTypeOptions,
    svTypeFilter,
    filterText,
    visibleRows,
    selectedRowId,
  } = model
  const { classes } = useStyles()
  const apiRef = useGridApiRef()
  // gate on the grid actually being rendered: rows start undefined while data
  // loads, so apiRef.current isn't populated on the first effect run — re-run
  // once the grid mounts
  const gridReady = !!(rows && dataGridColumns)

  // Two directions, two mechanisms, and what separates them is what each can
  // track.
  //
  // MODEL -> GRID is an `autorun`: it re-runs on whatever it read, where a
  // dependency array is a hand-maintained restatement of the body that goes
  // stale as soon as the body reads one more thing. This one already did — the
  // SV-type push grew a read of the class tally, and the array had to be
  // corrected to match it.
  //
  // Both pushes compare before writing, so the round trip with the handlers
  // below settles in one pass rather than ping-ponging, and both read the
  // grid's current value rather than trusting a ref, so a remount (session
  // reload, StrictMode) re-applies instead of skipping.
  useEffect(() => {
    const api = apiRef.current
    if (!gridReady || !api) {
      return undefined
    }
    return disposeAll([
      // Driven through the grid's own filter pipeline rather than a parallel
      // row filter, so the `filteredRowsSet` handler below keeps everything
      // downstream (the SV inspector's circle) in sync, and it composes with
      // the user's column filters and quick search instead of replacing them.
      autorun(() => {
        const { svTypeColumnField, svTypeFilter, svTypeOptions } = model
        if (!svTypeColumnField) {
          return
        }
        if (svTypeFilter) {
          // `isAnyOf` over the class's raw tokens, not `equals` on the class:
          // the dropdown names a class (Breakend) while the column holds
          // whatever the caller wrote (BND, or TRA, or both in one file). A
          // value naming no class passes through as a token, so a session saved
          // before the dropdown spoke classes still filters to what it did then
          const { tokens } = svTypeOptions.find(
            o => o.type === svTypeFilter,
          ) ?? { tokens: [svTypeFilter] }
          api.upsertFilterItem({
            id: SV_TYPE_FILTER_ID,
            field: svTypeColumnField,
            operator: 'isAnyOf',
            value: tokens,
          })
        } else {
          api.deleteFilterItem({
            id: SV_TYPE_FILTER_ID,
            field: svTypeColumnField,
            operator: 'isAnyOf',
          })
        }
      }),
      // the search box is the grid's own uncontrolled state, so the persisted
      // text is pushed in rather than passed as a prop
      autorun(() => {
        const wanted = model.filterText?.split(' ').filter(Boolean) ?? []
        const current = gridQuickFilterValuesSelector(apiRef) ?? []
        if (current.join(' ') !== wanted.join(' ')) {
          api.setQuickFilterValues(wanted)
        }
      }),
      // Bring the selected row into view. A chord click in the SV inspector's
      // circle selects the record it drew, and the row it belongs to is
      // routinely hundreds of rows down a virtualized grid — off screen, and so
      // not in the DOM at all, which is why this scrolls rather than relying on
      // the highlight alone.
      autorun(() => {
        const { selectedRowId } = model
        if (selectedRowId !== undefined) {
          const rowIndex = api.getRowIndexRelativeToVisibleRows(selectedRowId)
          // -1 for a row the current filter leaves out, which is a real state:
          // the circle draws what the filter left, but a selection can outlive
          // the filter that was in force when it was made
          if (rowIndex >= 0) {
            api.scrollToIndexes({ rowIndex })
          }
        }
      }),
    ])
  }, [apiRef, model, gridReady])

  // GRID -> MODEL stays a pair of event subscriptions, which is a lifecycle and
  // is what an effect is for. Neither body takes its observables from the
  // closure — they are read off `model` when the event fires — so this depends
  // on the grid being mounted and nothing else, and a changing tally cannot
  // tear the subscriptions down and rebuild them.
  useEffect(() => {
    const api = apiRef.current
    if (!gridReady || !api) {
      return undefined
    }
    return disposeAll([
      // The visible-rows lookup is recomputed by the filter pipeline, which
      // fires `filteredRowsSet` only AFTER `filterModelChange`. Reading the
      // lookup inside the latter therefore returns the prior filter's result,
      // so anything downstream of visibleRows lagged a filter behind — or never
      // updated on the first one.
      api.subscribeEvent('filteredRowsSet', () => {
        model.setVisibleRows(gridVisibleRowsLookupSelector(apiRef))
      }),
      api.subscribeEvent('filterModelChange', filterModel => {
        model.setFilterText(
          filterModel.quickFilterValues?.join(' ') || undefined,
        )
        // the same direction for the SV-type dropdown: it owns one item in the
        // grid's filter model, but the grid's own filter panel can edit or
        // delete that item, and the dropdown then went on naming a filter
        // nothing was applying
        const { svTypeColumnField, svTypeOptions } = model
        if (svTypeColumnField) {
          const item = filterModel.items.find(
            i => i.id === SV_TYPE_FILTER_ID && i.field === svTypeColumnField,
          )
          // the item's value is the class's raw tokens; map it back to the
          // class the dropdown names. An edit that no longer matches a class
          // clears the dropdown rather than leaving it naming something else
          const tokens = Array.isArray(item?.value)
            ? (item.value as string[])
            : []
          model.setSvTypeFilter(
            svTypeOptions.find(
              o =>
                o.tokens.length === tokens.length &&
                o.tokens.every(t => tokens.includes(t)),
            )?.type,
          )
        }
      }),
    ])
  }, [apiRef, model, gridReady])

  const showSvTypeFilter = !!svTypeColumnField && svTypeOptions.length > 0
  return rows && dataGridColumns ? (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {showSvTypeFilter || filterText ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            margin: 8,
          }}
        >
          {showSvTypeFilter ? (
            <TextField
              select
              variant="outlined"
              size="small"
              label="Filter by SV type"
              value={svTypeFilter ?? ''}
              onChange={event => {
                model.setSvTypeFilter(event.target.value || undefined)
              }}
              sx={{ minWidth: 160 }}
            >
              <MenuItem value="">All</MenuItem>
              {svTypeOptions.map(opt => (
                <MenuItem key={opt.type} value={opt.type}>
                  {opt.label} ({opt.count})
                </MenuItem>
              ))}
            </TextField>
          ) : null}
          {/* The search itself lives in the grid's own toolbar, which collapses
              to a magnifier once it loses focus — so with a search applied the
              rows are gone and nothing on screen says why. That is worst
              exactly where the search matters most: a session or a link that
              restores one, and the SV inspector's circle, which draws the rows
              the search leaves and would otherwise read as a smaller callset.
              The count is of rows actually shown, so it stays true when a
              column filter is narrowing things as well. */}
          {filterText ? (
            <Chip
              size="small"
              label={`Search "${filterText}": showing ${visibleRows?.length ?? 0} of ${rows.length} rows`}
              onDelete={() => {
                model.setFilterText(undefined)
              }}
            />
          ) : null}
        </div>
      ) : null}
      <div style={{ flex: 1, minHeight: 0 }}>
        <DataGrid
          data-testid="spreadsheet-view-data-grid"
          apiRef={apiRef}
          columnHeaderHeight={35}
          columnVisibilityModel={visibleColumns}
          onColumnVisibilityModelChange={n => {
            model.setVisibleColumns(n)
          }}
          rowHeight={25}
          hideFooter={rows.length < 100}
          slotProps={{
            toolbar: {
              showQuickFilter: true,
            },
          }}
          showToolbar
          rows={rows}
          columns={dataGridColumns}
          // the other direction of the same channel the circle reads: clicking
          // a row lights its chord, the way clicking a chord lands on its row
          onRowClick={({ row }) => {
            model.setSelectedFeature(row.feature)
          }}
          getRowClassName={({ id }) =>
            id === selectedRowId ? classes.selectedRow : ''
          }
        />
      </div>
    </div>
  ) : null
})

export default SpreadsheetDataGrid
