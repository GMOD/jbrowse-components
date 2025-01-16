import { useState } from 'react'

import { getEnv, measureGridWidth } from '@jbrowse/core/util'
import { DataGrid, GridToolbar  } from '@mui/x-data-grid'
import { transaction } from 'mobx'
import { getRoot, resolveIdentifier } from 'mobx-state-tree'

import type { HierarchicalTrackSelectorModel } from '../../model'
import type { GridColDef } from '@mui/x-data-grid'

export default function FacetedDataGrid({
  model,
  columns,
  shownTrackIds,
  selection,
}: {
  model: HierarchicalTrackSelectorModel
  filteredRows: any[]
  visible: Record<string, boolean>
  columns: GridColDef[]
  showOptions: boolean
  useShoppingCart: boolean
  shownTrackIds: Set<string>
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

  const [widths, setWidths] = useState<Record<string, number>>({
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
        .map(e => {
          return [
            `metadata.${e}`,
            measureGridWidth(
              rows.map(r => r.metadata[e]),
              { maxWidth: 400, stripHTML: true },
            ),
          ]
        }),
    ),
  })

  return (
    <DataGrid
      rows={filteredRows}
      onColumnWidthChange={arg => {
        setWidths({
          ...widths,
          [arg.colDef.field]: arg.width,
        })
      }}
      columnVisibilityModel={visible}
      onColumnVisibilityModelChange={n => {
        model.faceted.setVisible(n)
      }}
      columnHeaderHeight={35}
      checkboxSelection
      disableRowSelectionOnClick
      keepNonExistentRowsSelected
      onRowSelectionModelChange={userSelectedIds => {
        if (!useShoppingCart) {
          const a1 = shownTrackIds
          const a2 = new Set(userSelectedIds as string[])
          // synchronize the user selection with the view
          // see share https://stackoverflow.com/a/33034768/2129219
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
            userSelectedIds.map(id => resolveIdentifier(schema, root, id)),
          )
        }
      }}
      rowSelectionModel={
        useShoppingCart ? selection.map(s => s.trackId) : [...shownTrackIds]
      }
      slots={{
        toolbar: showOptions ? GridToolbar : null,
      }}
      slotProps={{
        toolbar: {
          printOptions: {
            disableToolbarButton: true,
          },
        },
      }}
      columns={columns.map(r => ({
        ...r,
        width: widths[r.field],
      }))}
      rowHeight={25}
    />
  )
}
