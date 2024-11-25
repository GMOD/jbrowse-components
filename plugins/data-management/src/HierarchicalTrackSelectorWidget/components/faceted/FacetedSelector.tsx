import React, { useState } from 'react'

// jbrowse
import { ResizeHandle } from '@jbrowse/core/ui'
import SanitizedHTML from '@jbrowse/core/ui/SanitizedHTML'
import { getEnv, measureGridWidth } from '@jbrowse/core/util'
import { DataGrid, GridToolbar } from '@mui/x-data-grid'
import { transaction } from 'mobx'
import { observer } from 'mobx-react'
import { getRoot, resolveIdentifier } from 'mobx-state-tree'
import { makeStyles } from 'tss-react/mui'

// locals
import FacetFilters from './FacetFilters'
import FacetedHeader from './FacetedHeader'
import TrackLabelMenu from '../tree/TrackLabelMenu'
import type { HierarchicalTrackSelectorModel } from '../../model'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { GridColDef } from '@mui/x-data-grid'

export interface InfoArgs {
  target: HTMLElement
  id: string
  conf: AnyConfigurationModel
}

const useStyles = makeStyles()({
  cell: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  resizeHandle: {
    marginLeft: 5,
    background: 'grey',
    width: 5,
  },
})

const frac = 0.75

const FacetedSelector = observer(function FacetedSelector({
  model,
}: {
  model: HierarchicalTrackSelectorModel
}) {
  const { classes } = useStyles()
  const { view, selection, shownTrackIds, faceted } = model
  const {
    rows,
    panelWidth,
    showFilters,
    useShoppingCart,
    showOptions,
    filteredRows,
    filteredNonMetadataKeys,
    filteredMetadataKeys,
    visible,
  } = faceted
  const { pluginManager } = getEnv(model)

  type T = GridColDef<(typeof filteredRows)[0]>

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
  const columns: T[] = [
    {
      field: 'name',
      hideable: false,
      renderCell: params => {
        const { value, row } = params
        const { id, conf } = row
        return (
          <div className={classes.cell}>
            <SanitizedHTML html={value as string} />
            <TrackLabelMenu id={id} conf={conf} trackId={id} model={model} />
          </div>
        )
      },
      width: widths.name ?? 100,
    },
    ...filteredNonMetadataKeys.map(e => {
      return {
        field: e,
        width: widths[e] ?? 100,
        renderCell: params => {
          const val = params.value
          return val ? (
            <SanitizedHTML className={classes.cell} html={val} />
          ) : (
            ''
          )
        },
      } satisfies T
    }),
    ...filteredMetadataKeys.map(e => {
      return {
        field: `metadata.${e}`,
        headerName: ['name', ...filteredNonMetadataKeys].includes(e)
          ? `${e} (from metadata)`
          : e,
        width: widths[`metadata.${e}`] ?? 100,
        valueGetter: (_, row) => `${row.metadata[e] ?? ''}`,
        renderCell: params => {
          const val = params.value
          return val ? (
            <SanitizedHTML className={classes.cell} html={val} />
          ) : (
            ''
          )
        },
      } satisfies T
    }),
  ]

  return (
    <>
      <FacetedHeader model={model} />
      <div
        style={{
          display: 'flex',
          overflow: 'hidden',
          height: window.innerHeight * frac,
          width: window.innerWidth * frac,
        }}
      >
        <div
          style={{
            height: window.innerHeight * frac,
            width: window.innerWidth * frac - (showFilters ? panelWidth : 0),
          }}
        >
          <DataGrid
            rows={filteredRows}
            onColumnWidthChange={arg => {
              setWidths({ ...widths, [arg.colDef.field]: arg.width })
            }}
            columnVisibilityModel={visible}
            onColumnVisibilityModelChange={n => {
              faceted.setVisible(n)
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
                  userSelectedIds.map(id =>
                    resolveIdentifier(schema, root, id),
                  ),
                )
              }
            }}
            rowSelectionModel={
              useShoppingCart
                ? selection.map(s => s.trackId)
                : [...shownTrackIds]
            }
            slots={{ toolbar: showOptions ? GridToolbar : null }}
            slotProps={{
              toolbar: {
                printOptions: {
                  disableToolbarButton: true,
                },
              },
            }}
            columns={columns}
            rowHeight={25}
          />
        </div>

        {showFilters ? (
          <>
            <ResizeHandle
              vertical
              onDrag={dist => faceted.setPanelWidth(panelWidth - dist)}
              className={classes.resizeHandle}
            />
            <div style={{ width: panelWidth, overflow: 'auto' }}>
              <FacetFilters model={model} rows={rows} columns={columns} />
            </div>
          </>
        ) : null}
      </div>
    </>
  )
})

export default FacetedSelector
