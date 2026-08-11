import { useEffect } from 'react'

import { Chip, MenuItem, TextField } from '@mui/material'
import { DataGrid, useGridApiRef } from '@mui/x-data-grid'
import {
  gridQuickFilterValuesSelector,
  gridVisibleRowsLookupSelector,
} from '@mui/x-data-grid/hooks'
import { observer } from 'mobx-react'

import type { SpreadsheetModel } from '../SpreadsheetModel.tsx'

// stable id so the dropdown's filter item is upserted/replaced in place rather
// than stacking alongside the user's own column filters and quick-filter search
const SV_TYPE_FILTER_ID = 'sv-type-quick-filter'

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
  } = model
  const apiRef = useGridApiRef()
  // gate the subscription on the grid actually being rendered: rows start
  // undefined while data loads, so apiRef.current isn't populated on the first
  // effect run — re-run once the grid mounts.
  const gridReady = !!(rows && dataGridColumns)

  // The visible-rows lookup is recomputed by the filter pipeline, which fires
  // `filteredRowsSet` only AFTER `filterModelChange`. Reading the lookup inside
  // onFilterModelChange therefore returns the prior filter's result, so anything
  // downstream of visibleRows (the SV-inspector circular view) lagged a filter
  // behind — or never updated on the first filter. Sync off filteredRowsSet so
  // visibleRows reflects the filter that just ran (covers column filters and the
  // quick-filter search box alike).
  useEffect(() => {
    if (gridReady) {
      return apiRef.current?.subscribeEvent('filteredRowsSet', () => {
        model.setVisibleRows(gridVisibleRowsLookupSelector(apiRef))
      })
    }
    return undefined
  }, [apiRef, model, gridReady])

  // Drive the SVTYPE dropdown through the grid's own filter pipeline (rather
  // than a parallel row filter) so the existing filteredRowsSet handler keeps
  // the circular view / downstream views in sync, and it composes with the
  // user's column filters and quick search instead of replacing them.
  useEffect(() => {
    const api = apiRef.current
    if (gridReady && svTypeColumnField && api) {
      if (svTypeFilter) {
        api.upsertFilterItem({
          id: SV_TYPE_FILTER_ID,
          field: svTypeColumnField,
          operator: 'equals',
          value: svTypeFilter,
        })
      } else {
        api.deleteFilterItem({
          id: SV_TYPE_FILTER_ID,
          field: svTypeColumnField,
          operator: 'equals',
        })
      }
    }
  }, [apiRef, gridReady, svTypeColumnField, svTypeFilter])

  // The search box is the grid's own uncontrolled state, so the persisted
  // `filterText` is pushed in rather than passed as a prop: the two effects are
  // the two directions of one binding. Both compare before writing, so the
  // round trip settles after one pass instead of ping-ponging — and the push
  // has to survive a remount (session reload, StrictMode) rather than only
  // running on a change, which is why it reads the grid's current values
  // instead of trusting a ref.
  useEffect(() => {
    const api = apiRef.current
    if (gridReady && api) {
      const wanted = filterText?.split(' ').filter(Boolean) ?? []
      const current = gridQuickFilterValuesSelector(apiRef) ?? []
      if (current.join(' ') !== wanted.join(' ')) {
        api.setQuickFilterValues(wanted)
      }
    }
  }, [apiRef, gridReady, filterText])

  useEffect(() => {
    if (gridReady) {
      return apiRef.current?.subscribeEvent(
        'filterModelChange',
        filterModel => {
          model.setFilterText(
            filterModel.quickFilterValues?.join(' ') || undefined,
          )
          // the same direction for the SV-type dropdown: it owns one item in
          // the grid's filter model, but the grid's own filter panel can edit
          // or delete that item, and the dropdown then went on naming a filter
          // nothing was applying. Reading it back keeps the two spellings of
          // the one filter agreed
          if (svTypeColumnField) {
            const item = filterModel.items.find(
              i => i.id === SV_TYPE_FILTER_ID && i.field === svTypeColumnField,
            )
            model.setSvTypeFilter(
              typeof item?.value === 'string' && item.value
                ? item.value
                : undefined,
            )
          }
        },
      )
    }
    return undefined
  }, [apiRef, model, gridReady, svTypeColumnField])

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
                <MenuItem key={opt} value={opt}>
                  {opt}
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
        />
      </div>
    </div>
  ) : null
})

export default SpreadsheetDataGrid
