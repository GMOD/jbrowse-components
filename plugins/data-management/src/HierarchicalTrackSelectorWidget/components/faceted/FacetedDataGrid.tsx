import { useMemo, useState, useTransition } from 'react'

import { getEnv } from '@jbrowse/core/util'
import { getRoot, resolveIdentifier } from '@jbrowse/mobx-state-tree'
import { DataGrid } from '@mui/x-data-grid'
import { transaction } from 'mobx'
import { observer } from 'mobx-react'

import { computeInitialWidths } from './computeInitialWidths.ts'

import type { HierarchicalTrackSelectorModel } from '../../model.ts'
import type { GridColDef, GridRowId } from '@mui/x-data-grid'

const FacetedDataGrid = observer(function FacetedDataGrid({
  model,
  columns,
  shownTrackIds,
  selection,
}: {
  model: HierarchicalTrackSelectorModel
  columns: GridColDef[]
  shownTrackIds: Set<GridRowId>
  selection: any[]
}) {
  const { pluginManager } = getEnv(model)
  const { view, faceted } = model
  const {
    rows,
    useShoppingCart,
    showOptions,
    filteredRows,
    filteredNonMetadataKeys,
    filteredMetadataKeys,
    visible,
  } = faceted

  const [, startTransition] = useTransition()
  const [widths, setWidths] = useState(() =>
    computeInitialWidths(
      rows,
      filteredNonMetadataKeys,
      filteredMetadataKeys,
      visible,
    ),
  )

  const rowSelectionModel = useMemo(
    () => ({
      type: 'include' as const,
      ids: new Set(
        useShoppingCart ? selection.map(s => s.trackId) : [...shownTrackIds],
      ),
    }),
    [useShoppingCart, selection, shownTrackIds],
  )

  const columnsWithWidths = useMemo(
    () =>
      columns.map(
        r =>
          ({
            ...r,
            width: widths[r.field as keyof typeof widths],
          }) satisfies GridColDef<(typeof rows)[0]>,
      ),
    [columns, widths],
  )

  return (
    <DataGrid
      rowHeight={25}
      columnHeaderHeight={35}
      checkboxSelection
      disableRowSelectionOnClick
      keepNonExistentRowsSelected
      rows={filteredRows}
      columnVisibilityModel={visible}
      showToolbar={showOptions}
      onColumnWidthChange={arg => {
        setWidths(prev => ({
          ...prev,
          [arg.colDef.field]: arg.width,
        }))
      }}
      onColumnVisibilityModelChange={n => {
        model.faceted.setVisible(n)
      }}
      onRowSelectionModelChange={userSelectedIds => {
        startTransition(() => {
          if (!useShoppingCart) {
            const a1 = shownTrackIds
            const a2 = userSelectedIds.ids
            transaction(() => {
              ;[...a1].filter(x => !a2.has(x)).map(t => view.hideTrack(t))
              ;[...a2]
                .filter(x => !a1.has(x))
                .map(t => {
                  view.showTrack(t)
                  model.addToRecentlyUsed(t)
                })
            })
          } else {
            const root = getRoot(model)
            const schema = pluginManager.pluggableConfigSchemaType('track')
            model.setSelection(
              [...userSelectedIds.ids].map(id =>
                resolveIdentifier(schema, root, id),
              ),
            )
          }
        })
      }}
      rowSelectionModel={rowSelectionModel}
      columns={columnsWithWidths}
    />
  )
})

export default FacetedDataGrid
