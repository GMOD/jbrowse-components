import { useMemo, useState, useTransition } from 'react'

import { getEnv, measureGridWidth } from '@jbrowse/core/util'
import { getRoot, resolveIdentifier } from '@jbrowse/mobx-state-tree'
import { DataGrid } from '@mui/x-data-grid'
import { transaction } from 'mobx'
import { observer } from 'mobx-react'

import type { HierarchicalTrackSelectorModel } from '../../model'
import type { GridColDef, GridRowId } from '@mui/x-data-grid'

function computeInitialWidths(
  rows: { name: string; metadata: Record<string, string> }[],
  filteredNonMetadataKeys: string[],
  filteredMetadataKeys: string[],
  visible: Record<string, boolean>,
) {
  return {
    name:
      measureGridWidth(
        rows.map(r => r.name),
        { maxWidth: 500, stripHTML: true },
      ) + 15,
    ...Object.fromEntries(
      filteredNonMetadataKeys
        .filter(f => visible[f])
        .map(e => [
          e,
          measureGridWidth(
            rows.map(r => r[e as keyof typeof r] as string),
            { maxWidth: 400, stripHTML: true },
          ),
        ]),
    ),
    ...Object.fromEntries(
      filteredMetadataKeys
        .filter(f => visible[`metadata.${f}`])
        .map(e => [
          `metadata.${e}`,
          measureGridWidth(
            rows.map(r => r.metadata[e]),
            { maxWidth: 400, stripHTML: true },
          ),
        ]),
    ),
  }
}

const FacetedDataGrid = observer(function ({
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
            width: widths[r.field],
          }) satisfies GridColDef<(typeof rows)[0]>,
      ),
    [columns, widths, rows],
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
